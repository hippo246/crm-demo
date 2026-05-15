import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDd3hZ7WVt2HdOc2hixJ7lgUV_uTQmKeDA",
  authDomain: "crm-demo-105a1.firebaseapp.com",
  databaseURL: "https://crm-demo-105a1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "crm-demo-105a1",
  storageBucket: "crm-demo-105a1.firebasestorage.app",
  messagingSenderId: "409571537738",
  appId: "1:409571537738:web:6ffddc70b06eae7a1287b3"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
