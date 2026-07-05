import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FINAL_DB_NAME = 'pclist.db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pctyp TEXT,
    url TEXT,
    imgurl TEXT,
    name TEXT,
    model TEXT,
    note TEXT,
    price TEXT,
    linuxtext TEXT,
    linuxprice TEXT
  )
`;

const INSERT_SQL = `
  INSERT INTO products (pctyp, url, imgurl, name, model, note, price, linuxtext, linuxprice)
  VALUES (@pctyp, @url, @imgurl, @name, @model, @note, @price, @linuxtext, @linuxprice)
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

function normalizeImageUrl(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

function normalizeUrl(url) {
  if (url == null) return null;
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return String(url).trim() || null;
  }
}

function productKey({ url, note, price, linuxtext, linuxprice }) {
  return [
    normalizeUrl(url),
    normalizeNote(note),
    normalizePrice(price),
    linuxtext ?? null,
    normalizePrice(linuxprice),
  ].join('\0');
}

export class PclistDb {
  /**
   * @param {object} [options]
   * @param {string} [options.baseDir] - DB を置くディレクトリ（省略時はプロジェクトルート）
   * @param {string} [options.finalDbName] - 確定時のファイル名（省略時: pclist.db）
   */
  constructor(options = {}) {
    const baseDir = options.baseDir ?? projectRoot;
    const finalDbName = options.finalDbName ?? DEFAULT_FINAL_DB_NAME;

    this.baseDir = baseDir;
    this.finalPath = path.join(baseDir, finalDbName);
    this.tempPath = path.join(os.tmpdir(), `pclist-${process.pid}.db.tmp`);
    this.pctyp = null;

    for (const file of [this.tempPath, `${this.tempPath}-wal`, `${this.tempPath}-shm`, `${this.tempPath}-journal`]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    this.db = new DatabaseSync(this.tempPath);
    this.db.exec('PRAGMA journal_mode = DELETE');
    this.db.exec(CREATE_TABLE_SQL);
    this.insertStmt = this.db.prepare(INSERT_SQL);
    this.closed = false;
    this.seenKeys = new Set();
    this.skippedDuplicates = 0;
  }

  /** @param {'notepc' | 'pc'} pctyp */
  setPctyp(pctyp) {
    this.pctyp = pctyp;
  }

  insert({ pctyp, url, imgurl, name, model, note, price, linuxtext, linuxprice }) {
    const row = {
      pctyp: pctyp ?? this.pctyp ?? null,
      url: url ?? null,
      imgurl: normalizeImageUrl(imgurl),
      name: name ?? null,
      model: model ?? null,
      note: normalizeNote(note),
      price: normalizePrice(price),
      linuxtext: linuxtext ?? null,
      linuxprice: normalizePrice(linuxprice),
    };
    const key = productKey(row);
    if (this.seenKeys.has(key)) {
      this.skippedDuplicates++;
      return false;
    }
    this.seenKeys.add(key);
    this.insertStmt.run(row);
    return true;
  }

  count() {
    if (this.closed) return this.seenKeys.size;
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM products').get();
    return row.c;
  }

  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  /** 正常終了時: テンポラリ DB を finalPath にコピー */
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
    if (this.skippedDuplicates > 0) {
      console.log(`  重複 ${this.skippedDuplicates} 件をスキップしました`);
    }
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

/**
 * @param {object} [options]
 * @param {string} [options.baseDir]
 * @param {string} [options.finalDbName]
 */
export function createPclistDb(options) {
  return new PclistDb(options);
}
