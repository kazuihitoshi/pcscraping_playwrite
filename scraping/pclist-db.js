import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL_DB_NAME = 'pclist.db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    name TEXT,
    model TEXT,
    note TEXT,
    price TEXT,
    linuxtext TEXT,
    linuxprice TEXT
  )
`;

const INSERT_SQL = `
  INSERT INTO products (url, name, model, note, price, linuxtext, linuxprice)
  VALUES (@url, @name, @model, @note, @price, @linuxtext, @linuxprice)
`;

function normalizePrice(value) {
  if (value == null) return null;
  return String(value).replace(/,|円/g, '').trim() || null;
}

function normalizeNote(note) {
  if (note == null) return null;
  if (Array.isArray(note)) return note.join(' ').trim() || null;
  return String(note).trim() || null;
}

export class PclistDb {
  /**
   * @param {string} [baseDir] - DB を置くディレクトリ（省略時はプロジェクトルート）
   */
  constructor(baseDir = projectRoot) {
    this.baseDir = baseDir;
    this.finalPath = path.join(baseDir, FINAL_DB_NAME);
    this.tempPath = path.join(os.tmpdir(), `pclist-${process.pid}.db.tmp`);

    for (const file of [this.tempPath, `${this.tempPath}-wal`, `${this.tempPath}-shm`, `${this.tempPath}-journal`]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    this.db = new DatabaseSync(this.tempPath);
    this.db.exec('PRAGMA journal_mode = DELETE');
    this.db.exec(CREATE_TABLE_SQL);
    this.insertStmt = this.db.prepare(INSERT_SQL);
    this.closed = false;
  }

  insert({ url, name, model, note, price, linuxtext, linuxprice }) {
    this.insertStmt.run({
      url: url ?? null,
      name: name ?? null,
      model: model ?? null,
      note: normalizeNote(note),
      price: normalizePrice(price),
      linuxtext: linuxtext ?? null,
      linuxprice: normalizePrice(linuxprice),
    });
  }

  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  /** 正常終了時: テンポラリ DB を pclist.db にリネーム */
  finalize() {
    this.close();
    if (!fs.existsSync(this.tempPath)) {
      throw new Error(`テンポラリ DB が見つかりません: ${this.tempPath}`);
    }
    if (fs.existsSync(this.finalPath)) {
      fs.unlinkSync(this.finalPath);
    }
    fs.copyFileSync(this.tempPath, this.finalPath);
    this.removeTempFiles();
    console.log(`✓ データベースを保存しました: ${this.finalPath}`);
  }

  removeTempFiles() {
    for (const file of [this.tempPath, `${this.tempPath}-wal`, `${this.tempPath}-shm`, `${this.tempPath}-journal`]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }

  /** 異常終了時: テンポラリ DB を削除 */
  discard() {
    this.close();
    this.removeTempFiles();
    console.log(`テンポラリ DB を削除しました: ${this.tempPath}`);
  }
}

export function createPclistDb(baseDir) {
  return new PclistDb(baseDir);
}
