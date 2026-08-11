const firebaseConfig = {
  apiKey: 'AIzaSyCmMhetbyG1ozSsFMNYC9Q_EBADLPskTdg',
  authDomain: 'sunflower-calculadora.firebaseapp.com',
  projectId: 'sunflower-calculadora',
  storageBucket: 'sunflower-calculadora.firebasestorage.app',
  messagingSenderId: '175990453610',
  appId: '1:175990453610:web:aacd735238e627c5fc2113',
  measurementId: 'G-B1SZC92YQZ',
};

firebase.initializeApp(firebaseConfig);

try {
  firebase.analytics();
} catch (e) {
  console.warn('Analytics not available:', e.message);
}

const db = firebase.firestore();
const TRACKER_COLLECTION = 'tracker';

let unsubSnapshot = null;

function getTrackerRef() {
  const user = firebase.auth().currentUser;
  if (!user) return Promise.reject(new Error('Usuário não logado'));
  return Promise.resolve(db.collection(TRACKER_COLLECTION).doc(user.uid));
}

function onTrackerSnapshot(callback) {
  getTrackerRef().then(ref => {
    unsubSnapshot = ref.onSnapshot(
      doc => {
        if (doc.exists) {
          callback(doc.data());
        } else {
          callback({ dados: [], taxas: null, version: 0 });
        }
      },
      err => console.warn('Snapshot error:', err.message)
    );
  }).catch(() => {});
}

function unsubscribeSnapshot() {
  if (unsubSnapshot) {
    unsubSnapshot();
    unsubSnapshot = null;
  }
}

async function resetFirebase() {
  unsubscribeSnapshot();
  try {
    const ref = await getTrackerRef();
    await ref.set({
      dados: [],
      taxas: {},
      version: 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await firebase.auth().signOut();
  } catch (e) {
  }
}
