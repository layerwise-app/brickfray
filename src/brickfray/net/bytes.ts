/** Growable little-endian binary writer. */
export class Writer {
  private view: DataView;
  private bytes: Uint8Array;
  offset = 0;

  constructor(size = 512) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }

  private ensure(n: number) {
    if (this.offset + n <= this.bytes.length) return;
    const next = new Uint8Array(Math.max(this.bytes.length * 2, this.offset + n));
    next.set(this.bytes);
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }
  u8(v: number) {
    this.ensure(1);
    this.view.setUint8(this.offset++, Math.max(0, Math.min(255, Math.round(v))));
  }
  i8(v: number) {
    this.ensure(1);
    this.view.setInt8(this.offset++, Math.max(-128, Math.min(127, Math.round(v))));
  }
  u16(v: number) {
    this.ensure(2);
    this.view.setUint16(this.offset, Math.max(0, Math.min(65535, Math.round(v))), true);
    this.offset += 2;
  }
  i16(v: number) {
    this.ensure(2);
    this.view.setInt16(this.offset, Math.max(-32768, Math.min(32767, Math.round(v))), true);
    this.offset += 2;
  }
  u32(v: number) {
    this.ensure(4);
    this.view.setUint32(this.offset, v >>> 0, true);
    this.offset += 4;
  }
  f32(v: number) {
    this.ensure(4);
    this.view.setFloat32(this.offset, v, true);
    this.offset += 4;
  }
  f64(v: number) {
    this.ensure(8);
    this.view.setFloat64(this.offset, v, true);
    this.offset += 8;
  }
  finish(): ArrayBuffer {
    return this.bytes.slice(0, this.offset).buffer;
  }
}

export class Reader {
  private view: DataView;
  offset = 0;
  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }
  get done() {
    return this.offset >= this.view.byteLength;
  }
  u8() {
    return this.view.getUint8(this.offset++);
  }
  i8() {
    return this.view.getInt8(this.offset++);
  }
  u16() {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  i16() {
    const v = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return v;
  }
  u32() {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f32() {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f64() {
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }
}
