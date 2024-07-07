import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'proust';

/*
 * Open a new IndexedDB database.
 *
 * @return {IDBPDatabase} The newly opened database instance.
 */
export const open = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, 2, {
    upgrade(db, _oldVersion, _newVersion, _transaction) {
      db.createObjectStore('pdfs');
      db.createObjectStore('chunks');
      db.createObjectStore('embeddings');
    },
  });
};
