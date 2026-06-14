import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { HostMachine, TerminalLog, ChatMessage, AuthorizedUser } from '../types';

// Catch and format Firestore Errors securely
const handleFirestoreError = (action: string, error: any) => {
  console.error(`Firestore Error [${action}]:`, error);
  throw {
    code: 'database-error',
    message: `Database failure during ${action}: ${error.message || String(error)}`,
    details: error
  };
};

// Hosts Synchronization
export const subscribeHosts = (
  userId: string, 
  onUpdate: (hosts: HostMachine[]) => void
) => {
  try {
    const q = collection(db, 'users', userId, 'hosts');
    return onSnapshot(q, (snapshot) => {
      const hosts: HostMachine[] = [];
      snapshot.forEach((doc) => {
        hosts.push({ id: doc.id, ...doc.data() } as HostMachine);
      });
      onUpdate(hosts);
    }, (error) => {
      handleFirestoreError('subscribeHosts', error);
    });
  } catch (error) {
    handleFirestoreError('subscribeHosts', error);
  }
};

export const addFirestoreHost = async (userId: string, host: Omit<HostMachine, 'id'>) => {
  try {
    const hostId = `host-${Date.now()}`;
    const docRef = doc(db, 'users', userId, 'hosts', hostId);
    const hostData = {
      ...host,
      id: hostId,
      port: Number(host.port) || 22,
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, hostData);
    return hostData;
  } catch (error) {
    handleFirestoreError('addFirestoreHost', error);
  }
};

export const updateFirestoreHost = async (userId: string, hostId: string, host: Partial<HostMachine>) => {
  try {
    const docRef = doc(db, 'users', userId, 'hosts', hostId);
    await setDoc(docRef, {
      ...host,
      port: Number(host.port) || 22
    }, { merge: true });
  } catch (error) {
    handleFirestoreError('updateFirestoreHost', error);
  }
};

export const deleteFirestoreHost = async (userId: string, hostId: string) => {
  try {
    const docRef = doc(db, 'users', userId, 'hosts', hostId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError('deleteFirestoreHost', error);
  }
};

// Chats Synchronization
export const subscribeChats = (
  userId: string, 
  onUpdate: (messages: ChatMessage[]) => void
) => {
  try {
    const q = query(
      collection(db, 'users', userId, 'chats'), 
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      onUpdate(messages);
    }, (error) => {
      handleFirestoreError('subscribeChats', error);
    });
  } catch (error) {
    handleFirestoreError('subscribeChats', error);
  }
};

export const addFirestoreChat = async (userId: string, message: Omit<ChatMessage, 'id'>) => {
  try {
    const chatId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, 'users', userId, 'chats', chatId);
    const chatData = {
      ...message,
      id: chatId,
      timestamp: message.timestamp || new Date().toISOString()
    };
    await setDoc(docRef, chatData);
    return chatData;
  } catch (error) {
    handleFirestoreError('addFirestoreChat', error);
  }
};

export const clearFirestoreChats = async (userId: string) => {
  try {
    const q = collection(db, 'users', userId, 'chats');
    const batch = writeBatch(db);
    // Standard firebase delete loop
    return onSnapshot(q, (snapshot) => {
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      batch.commit();
    });
  } catch (error) {
    handleFirestoreError('clearFirestoreChats', error);
  }
};

// Logs Synchronization
export const subscribeLogs = (
  userId: string, 
  onUpdate: (logs: TerminalLog[]) => void
) => {
  try {
    const q = query(
      collection(db, 'users', userId, 'logs'), 
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      const logs: TerminalLog[] = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as TerminalLog);
      });
      onUpdate(logs);
    }, (error) => {
      handleFirestoreError('subscribeLogs', error);
    });
  } catch (error) {
    handleFirestoreError('subscribeLogs', error);
  }
};

export const addFirestoreLog = async (userId: string, log: Omit<TerminalLog, 'id'>) => {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, 'users', userId, 'logs', logId);
    const logData = {
      ...log,
      id: logId,
      timestamp: log.timestamp || new Date().toISOString()
    };
    await setDoc(docRef, logData);
    return logData;
  } catch (error) {
    handleFirestoreError('addFirestoreLog', error);
  }
};

// Authorized Users Management
export const subscribeAuthorizedUsers = (
  onUpdate: (users: AuthorizedUser[]) => void
) => {
  try {
    const q = collection(db, 'authorizedUsers');
    return onSnapshot(q, (snapshot) => {
      const users: AuthorizedUser[] = [];
      snapshot.forEach((doc) => {
        users.push({ email: doc.id, ...doc.data() } as AuthorizedUser);
      });
      onUpdate(users);
    }, (error) => {
      handleFirestoreError('subscribeAuthorizedUsers', error);
    });
  } catch (error) {
    handleFirestoreError('subscribeAuthorizedUsers', error);
  }
};

export const addFirestoreAuthorizedUser = async (user: AuthorizedUser) => {
  try {
    const emailKey = user.email.trim().toLowerCase();
    const docRef = doc(db, 'authorizedUsers', emailKey);
    const userData = {
      email: emailKey,
      role: user.role,
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, userData);
    return userData;
  } catch (error) {
    handleFirestoreError('addFirestoreAuthorizedUser', error);
  }
};

export const updateFirestoreAuthorizedUser = async (email: string, user: Partial<AuthorizedUser>) => {
  try {
    const emailKey = email.trim().toLowerCase();
    const docRef = doc(db, 'authorizedUsers', emailKey);
    await setDoc(docRef, user, { merge: true });
  } catch (error) {
    handleFirestoreError('updateFirestoreAuthorizedUser', error);
  }
};

export const deleteFirestoreAuthorizedUser = async (email: string) => {
  try {
    const emailKey = email.trim().toLowerCase();
    const docRef = doc(db, 'authorizedUsers', emailKey);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError('deleteFirestoreAuthorizedUser', error);
  }
};
