package com.parthmobilecare

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

class DeviceSecurityModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "DeviceSecurityModule"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val DEFAULT_KEY_ALIAS = "pmc_device_key_secp256r1"
    }

    override fun getName(): String = "DeviceSecurityModule"

    @ReactMethod
    fun getDeviceModel(promise: Promise) {
        try {
            val manufacturer = Build.MANUFACTURER?.trim() ?: "Android"
            val model = Build.MODEL?.trim() ?: "Device"
            val formatted = if (model.startsWith(manufacturer, ignoreCase = true)) {
                model
            } else {
                "${manufacturer.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }} $model"
            }
            promise.resolve(formatted)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting device model", e)
            promise.resolve("Android Client")
        }
    }

    @ReactMethod
    fun getOrCreateDeviceKey(aliasInput: String?, promise: Promise) {
        try {
            val alias = if (aliasInput.isNullOrBlank()) DEFAULT_KEY_ALIAS else aliasInput
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

            if (!keyStore.containsAlias(alias)) {
                generateEcKeyPair(alias)
            }

            val cert = keyStore.getCertificate(alias)
            if (cert == null || cert.publicKey == null) {
                promise.reject("KEY_RETRIEVAL_FAILED", "Could not retrieve certificate for alias: $alias")
                return
            }

            val publicKeyBytes = cert.publicKey.encoded
            val publicKeyBase64 = Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP)

            val result: WritableMap = Arguments.createMap().apply {
                putString("publicKey", publicKeyBase64)
                putString("alias", alias)
                putString("algorithm", cert.publicKey.algorithm)
                putString("format", cert.publicKey.format ?: "X.509")
                putBoolean("isHardwareBacked", isKeyHardwareBacked(keyStore, alias))
            }

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error in getOrCreateDeviceKey", e)
            promise.reject("KEY_GEN_FAILED", e.message ?: "Failed to get or create device key", e)
        }
    }

    @ReactMethod
    fun signPayload(aliasInput: String?, payload: String, promise: Promise) {
        try {
            val alias = if (aliasInput.isNullOrBlank()) DEFAULT_KEY_ALIAS else aliasInput
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

            if (!keyStore.containsAlias(alias)) {
                promise.reject("KEY_NOT_FOUND", "No hardware key found for alias: $alias")
                return
            }

            val privateKey = keyStore.getKey(alias, null) as? PrivateKey
            if (privateKey == null) {
                promise.reject("PRIVATE_KEY_NULL", "Private key is inaccessible or null")
                return
            }

            val signature = Signature.getInstance("SHA256withECDSA").apply {
                initSign(privateKey)
                update(payload.toByteArray(Charsets.UTF_8))
            }

            val signatureBytes = signature.sign()
            val signatureBase64 = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)

            promise.resolve(signatureBase64)
        } catch (e: Exception) {
            Log.e(TAG, "Error in signPayload", e)
            promise.reject("SIGNING_FAILED", e.message ?: "Failed to sign payload", e)
        }
    }

    @ReactMethod
    fun hasDeviceKey(aliasInput: String?, promise: Promise) {
        try {
            val alias = if (aliasInput.isNullOrBlank()) DEFAULT_KEY_ALIAS else aliasInput
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            promise.resolve(keyStore.containsAlias(alias))
        } catch (e: Exception) {
            promise.reject("KEY_CHECK_FAILED", e.message ?: "Failed to check key existence", e)
        }
    }

    @ReactMethod
    fun deleteDeviceKey(aliasInput: String?, promise: Promise) {
        try {
            val alias = if (aliasInput.isNullOrBlank()) DEFAULT_KEY_ALIAS else aliasInput
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            if (keyStore.containsAlias(alias)) {
                keyStore.deleteEntry(alias)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("KEY_DELETE_FAILED", e.message ?: "Failed to delete key", e)
        }
    }

    private fun generateEcKeyPair(alias: String) {
        val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)

        val purposes = KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        val specBuilder = KeyGenParameterSpec.Builder(alias, purposes)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)

        // Attempt StrongBox security module if available on modern hardware (Android 9+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                specBuilder.setIsStrongBoxBacked(true)
                kpg.initialize(specBuilder.build())
                kpg.generateKeyPair()
                Log.i(TAG, "Generated hardware key backed by StrongBox")
                return
            } catch (strongBoxEx: Exception) {
                Log.w(TAG, "StrongBox unavailable, falling back to standard TEE AndroidKeyStore", strongBoxEx)
                specBuilder.setIsStrongBoxBacked(false)
            }
        }

        kpg.initialize(specBuilder.build())
        kpg.generateKeyPair()
        Log.i(TAG, "Generated hardware key backed by TEE AndroidKeyStore")
    }

    private fun isKeyHardwareBacked(keyStore: KeyStore, alias: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val privateKey = keyStore.getKey(alias, null) as? PrivateKey ?: return false
                val keyFactory = java.security.KeyFactory.getInstance(privateKey.algorithm, ANDROID_KEYSTORE)
                val keyInfo = keyFactory.getKeySpec(privateKey, android.security.keystore.KeyInfo::class.java)
                keyInfo.isInsideSecureHardware
            } else {
                false
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not determine hardware backing state", e)
            false
        }
    }
}

