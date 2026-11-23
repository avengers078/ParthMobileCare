package com.parthmobilecare

import android.app.Activity
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.print.pdf.PrintedPdfDocument
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class PdfModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "PdfModule"
    }

    override fun getName(): String = "PdfModule"

    @ReactMethod
    fun printHtml(html: String, jobName: String, promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is not available")
            return
        }

        activity.runOnUiThread {
            try {
                val webView = WebView(activity)
                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                        if (printManager != null) {
                            val printAdapter = webView.createPrintDocumentAdapter(jobName)
                            val builder = PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            printManager.print(jobName, printAdapter, builder.build())
                            promise.resolve(true)
                        } else {
                            promise.reject("PRINT_SERVICE_UNAVAILABLE", "Android PrintManager service is not available")
                        }
                    }
                }
                webView.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null)
            } catch (e: Exception) {
                promise.reject("PRINT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun exportAndShareFile(fileName: String, base64Data: String, mimeType: String, title: String, promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is not available")
            return
        }

        activity.runOnUiThread {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)

                // 1. Write file to application cache directory for FileProvider sharing
                val cacheFile = File(activity.cacheDir, fileName)
                FileOutputStream(cacheFile).use { out ->
                    out.write(bytes)
                    out.flush()
                }

                // 2. Also save a permanent copy to user Downloads directory
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val contentValues = ContentValues().apply {
                            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                        }
                        val downloadUri = activity.contentResolver.insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                            contentValues
                        )
                        if (downloadUri != null) {
                            activity.contentResolver.openOutputStream(downloadUri)?.use { out ->
                                out.write(bytes)
                                out.flush()
                            }
                        }
                    } else {
                        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        if (downloadsDir.exists() || downloadsDir.mkdirs()) {
                            val downloadFile = File(downloadsDir, fileName)
                            FileOutputStream(downloadFile).use { out ->
                                out.write(bytes)
                                out.flush()
                            }
                        }
                    }
                } catch (saveErr: Exception) {
                    Log.w(TAG, "Saving copy to Downloads directory skipped: ${saveErr.message}")
                }

                // 3. Share with proper FileProvider URI, ClipData, and permission grants
                val uri: Uri = FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.fileprovider",
                    cacheFile
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    clipData = ClipData.newRawUri(title, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val resInfoList = activity.packageManager.queryIntentActivities(
                    intent,
                    PackageManager.MATCH_DEFAULT_ONLY
                )
                for (resolveInfo in resInfoList) {
                    val packageName = resolveInfo.activityInfo.packageName
                    activity.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val chooser = Intent.createChooser(intent, title).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(chooser)
                promise.resolve(cacheFile.absolutePath)
            } catch (e: Exception) {
                Log.e(TAG, "Export and share error", e)
                promise.reject("EXPORT_SHARE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun shareFile(filePath: String, mimeType: String, title: String, promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is not available")
            return
        }

        activity.runOnUiThread {
            try {
                val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
                val file = File(cleanPath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "File does not exist: $cleanPath")
                    return@runOnUiThread
                }

                val uri: Uri = FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.fileprovider",
                    file
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    clipData = ClipData.newRawUri(title, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val resInfoList = activity.packageManager.queryIntentActivities(
                    intent,
                    PackageManager.MATCH_DEFAULT_ONLY
                )
                for (resolveInfo in resInfoList) {
                    val packageName = resolveInfo.activityInfo.packageName
                    activity.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val chooser = Intent.createChooser(intent, title).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(chooser)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("SHARE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun generatePdfFromHtml(html: String, fileName: String, promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is not available")
            return
        }

        activity.runOnUiThread {
            try {
                val webView = WebView(activity)
                val printAttributes = PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build()

                val a4Width = 595 // Standard A4 points (72 DPI)
                val a4Height = 842 // Standard A4 points (72 DPI)

                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        try {
                            webView.measure(
                                View.MeasureSpec.makeMeasureSpec(a4Width, View.MeasureSpec.EXACTLY),
                                View.MeasureSpec.makeMeasureSpec(a4Height, View.MeasureSpec.EXACTLY)
                            )
                            webView.layout(0, 0, a4Width, a4Height)

                            val pdfFile = File(activity.cacheDir, fileName)
                            if (pdfFile.exists()) {
                                pdfFile.delete()
                            }

                            val printedDoc = PrintedPdfDocument(activity, printAttributes)
                            val page = printedDoc.startPage(0)
                            webView.draw(page.canvas)
                            printedDoc.finishPage(page)

                            val fos = FileOutputStream(pdfFile)
                            printedDoc.writeTo(fos)
                            printedDoc.close()
                            fos.flush()
                            fos.close()

                            if (pdfFile.exists() && pdfFile.length() > 0) {
                                Log.i(TAG, "Generated PDF: ${pdfFile.absolutePath} (${pdfFile.length()} bytes)")
                                promise.resolve(pdfFile.absolutePath)
                            } else {
                                promise.reject("PDF_EMPTY", "Generated PDF file is empty")
                            }
                        } catch (err: Exception) {
                            Log.e(TAG, "Error generating PDF from HTML", err)
                            promise.reject("PDF_GEN_ERROR", err.message, err)
                        }
                    }
                }
                webView.loadDataWithBaseURL("https://parthmobilecare.local/", html, "text/html", "UTF-8", null)
            } catch (e: Exception) {
                Log.e(TAG, "WebView initialization error", e)
                promise.reject("WEBVIEW_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun shareFileToWhatsApp(filePath: String, message: String?, phone: String?, promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is not available")
            return
        }

        activity.runOnUiThread {
            try {
                val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
                val file = File(cleanPath)
                if (!file.exists() || file.length() == 0L) {
                    promise.reject("FILE_NOT_FOUND", "PDF file does not exist or is empty: $cleanPath")
                    return@runOnUiThread
                }

                val uri: Uri = FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.fileprovider",
                    file
                )

                val isWaInstalled = isPackageInstalled("com.whatsapp", activity) || isPackageInstalled("com.whatsapp.w4b", activity)
                val waPackage = if (isPackageInstalled("com.whatsapp", activity)) "com.whatsapp" else "com.whatsapp.w4b"

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/pdf"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    if (!message.isNullOrBlank()) {
                        putExtra(Intent.EXTRA_TEXT, message)
                    }
                    clipData = ClipData.newRawUri("Tax Invoice PDF", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                if (isWaInstalled) {
                    intent.setPackage(waPackage)
                    activity.grantUriPermission(waPackage, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    activity.startActivity(intent)
                    promise.resolve(true)
                } else {
                    // Graceful fallback to Android native share sheet if WhatsApp is not installed
                    val chooser = Intent.createChooser(intent, "Share Tax Invoice PDF").apply {
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    val resInfoList = activity.packageManager.queryIntentActivities(
                        chooser,
                        PackageManager.MATCH_DEFAULT_ONLY
                    )
                    for (resolveInfo in resInfoList) {
                        val packageName = resolveInfo.activityInfo.packageName
                        activity.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    activity.startActivity(chooser)
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "WhatsApp document share error", e)
                promise.reject("WHATSAPP_SHARE_ERROR", e.message, e)
            }
        }
    }

    private fun isPackageInstalled(packageName: String, context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }
}



