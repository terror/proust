import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'proust';

export const open = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, 2, {
    upgrade(db, _oldVersion, _newVersion, _transaction) {
      db.createObjectStore('workspaces');
      db.createObjectStore('chunks');
      db.createObjectStore('embeddings');
    },
  });
};
