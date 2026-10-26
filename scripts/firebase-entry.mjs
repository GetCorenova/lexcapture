/* Punto de entrada del paquete local de Firebase (vendor/firebase.js).
 *
 * La app es un HTML autónomo que se usa sin cobertura: el SDK no se pide a un
 * CDN en tiempo de ejecución, se empaqueta aquí con esbuild y viaja junto a la
 * app (GitHub Pages, la caché del Service Worker y el paquete de Android).
 *
 * Solo se exporta lo que usa la app. Quedan fuera a propósito:
 *  · el resolutor de ventanas emergentes de Auth (`browserPopupRedirectResolver`),
 *    que carga un iframe de Google: con correo y contraseña no hace falta, y
 *    dentro del envoltorio de Android Google bloquea esas ventanas;
 *  · la persistencia de Firestore en el navegador: los datos locales son de la
 *    app (cifrados con la llave del equipo), no del SDK. */
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, inMemoryPersistence, connectAuthEmulator,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, verifyPasswordResetCode,
  confirmPasswordReset, applyActionCode, checkActionCode,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword, deleteUser, reload
} from 'firebase/auth';
export {
  initializeFirestore, memoryLocalCache, connectFirestoreEmulator,
  doc, getDocFromServer, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp,
  /* F4: los registros de la nube (uno por documento) y su escucha en vivo. */
  collection, query, where, onSnapshot, getDocsFromServer, writeBatch, Timestamp
} from 'firebase/firestore';
/* F3: las funciones del servidor (la prueba gratuita y el derecho de uso). */
export { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
/* F6: App Check. En la app de Android, un proveedor PROPIO (`CustomProvider`)
   canjea un token de Play Integrity por uno de App Check (ver acToken en la app);
   el SDK lo adjunta solo a Firestore, Auth y las funciones. */
export { initializeAppCheck, CustomProvider } from 'firebase/app-check';
