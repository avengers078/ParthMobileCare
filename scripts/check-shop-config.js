const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: 'AIzaSyAdvwIbQjNYQQ4E9kgixdyJRlTk9W_GBHY',
  authDomain: 'parthmobilecare-a474d.firebaseapp.com',
  projectId: 'parthmobilecare-a474d',
};

async function check() {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Optional authenticated session if credentials provided via environment
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      console.log(`Authenticating as ${process.env.ADMIN_EMAIL}...`);
      try {
        await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
        console.log('Signed in successfully.');
      } catch (authErr) {
        console.log('Authentication failed:', authErr.code, authErr.message);
      }
    }

    console.log('Checking shop_config/main_store...');
    const snapStore = await getDoc(doc(db, 'shop_config', 'main_store'));
    if (snapStore.exists()) {
      console.log('main_store data:', JSON.stringify(snapStore.data(), null, 2));
    } else {
      console.log('main_store does NOT exist in Firestore');
    }

    console.log('Checking shop_config/main...');
    const snapMain = await getDoc(doc(db, 'shop_config', 'main'));
    if (snapMain.exists()) {
      console.log('main data:', JSON.stringify(snapMain.data(), null, 2));
    } else {
      console.log('main does NOT exist in Firestore');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error fetching shop config:', err.message || err);
    process.exit(1);
  }
}

check();
