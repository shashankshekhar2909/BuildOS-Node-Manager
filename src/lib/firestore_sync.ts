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
  writeBatch,
  where
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { HostMachine, TerminalLog, ChatMessage, AuthorizedUser, ChatSession } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Catch and format Firestore Errors securely
const handleFirestoreError = (action: string, error: any, customPath: string | null = null) => {
  console.error(`Firestore Error [${action}]:`, error);
  
  // Try to determine dynamic operation type
  let opType = OperationType.GET;
  const lowercaseAction = action.toLowerCase();
  if (lowercaseAction.includes('add') || lowercaseAction.includes('create') || lowercaseAction.includes('set')) {
    opType = OperationType.CREATE;
  } else if (lowercaseAction.includes('update') || lowercaseAction.includes('edit')) {
    opType = OperationType.UPDATE;
  } else if (lowercaseAction.includes('delete') || lowercaseAction.includes('remove') || lowercaseAction.includes('clear')) {
    opType = OperationType.DELETE;
  } else if (lowercaseAction.includes('subscribe') || lowercaseAction.includes('list') || lowercaseAction.includes('get')) {
    opType = lowercaseAction.includes('subscribe') ? OperationType.GET : OperationType.LIST;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType: opType,
    path: customPath || action,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    }
  };

  throw new Error(JSON.stringify(errInfo));
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
  sessionId: string | null,
  onUpdate: (messages: ChatMessage[]) => void
) => {
  try {
    let q;
    if (sessionId) {
      q = query(
        collection(db, 'users', userId, 'chats'),
        where('sessionId', '==', sessionId)
      );
    } else {
      q = query(
        collection(db, 'users', userId, 'chats'), 
        orderBy('timestamp', 'asc')
      );
    }
    return onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      // Sort in-memory if sessionId was used to ensure index-free sandbox compatibility
      if (sessionId) {
        messages.sort((a, b) => {
          const tA = new Date(a.timestamp).getTime();
          const tB = new Date(b.timestamp).getTime();
          return tA - tB;
        });
      }
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

export const clearFirestoreChatsBySession = async (userId: string, sessionId: string) => {
  try {
    const q = query(
      collection(db, 'users', userId, 'chats'),
      where('sessionId', '==', sessionId)
    );
    const batch = writeBatch(db);
    return onSnapshot(q, (snapshot) => {
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      batch.commit();
    });
  } catch (error) {
    handleFirestoreError('clearFirestoreChatsBySession', error);
  }
};

// Chat Sessions Synchronization
export const subscribeChatSessions = (
  userId: string,
  onUpdate: (sessions: ChatSession[]) => void
) => {
  try {
    const q = query(
      collection(db, 'users', userId, 'chatSessions'),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const sessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() } as ChatSession);
      });
      onUpdate(sessions);
    }, (error) => {
      handleFirestoreError('subscribeChatSessions', error);
    });
  } catch (error) {
    handleFirestoreError('subscribeChatSessions', error);
  }
};

export const addFirestoreChatSession = async (
  userId: string, 
  session: Omit<ChatSession, 'id' | 'userId'>
) => {
  try {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, 'users', userId, 'chatSessions', sessionId);
    const sessionData = {
      ...session,
      id: sessionId,
      userId,
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: session.updatedAt || new Date().toISOString()
    };
    await setDoc(docRef, sessionData);
    return sessionData;
  } catch (error) {
    handleFirestoreError('addFirestoreChatSession', error);
  }
};

export const updateFirestoreChatSessionTitle = async (
  userId: string,
  sessionId: string,
  title: string
) => {
  try {
    const docRef = doc(db, 'users', userId, 'chatSessions', sessionId);
    await setDoc(docRef, { 
      title,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError('updateFirestoreChatSessionTitle', error);
  }
};

export const deleteFirestoreChatSession = async (userId: string, sessionId: string) => {
  try {
    const docRef = doc(db, 'users', userId, 'chatSessions', sessionId);
    await deleteDoc(docRef);

    // Clean up messages in that session asynchronously
    await clearFirestoreChatsBySession(userId, sessionId);
  } catch (error) {
    handleFirestoreError('deleteFirestoreChatSession', error);
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
