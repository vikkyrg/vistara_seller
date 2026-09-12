import React, { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { FiX, FiAlertCircle } from 'react-icons/fi';

const SellerNotificationListener = () => {
  const isInitialLoad = useRef(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, "products"),
          where("sellerid", "==", user.uid),
          where("status", "==", "rejected")
        );

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
          }
          
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const product = change.doc.data();
              if (product.status === "rejected") {
                setNotification(`Admin Rejected: Your product "${product.name || 'Unknown'}" was rejected.`);
                setTimeout(() => setNotification(null), 8000);
              }
            }
          });
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  if (!notification) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-2xl z-[9999] flex items-start max-w-sm">
      <FiAlertCircle className="text-xl mr-3 mt-0.5 flex-shrink-0" />
      <div className="flex-1 font-semibold text-sm leading-snug">{notification}</div>
      <button onClick={() => setNotification(null)} className="ml-4 text-red-500 hover:text-red-700 flex-shrink-0">
        <FiX size={20} />
      </button>
    </div>
  );
};

export default SellerNotificationListener;
