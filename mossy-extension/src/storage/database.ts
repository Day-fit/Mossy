import { openDB } from 'idb';

export const openDatabase = () =>
    openDB('mossy-extension-v2', 1, {
        upgrade(db) {
            db.createObjectStore('device');
            db.createObjectStore('wrapped');
        },
    });
