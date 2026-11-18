// Preload for a test run: the process clock reads 23:59:30 local time when the
// run starts, and keeps ticking from there. Fake timers still override it.
const RealDate = Date;
const target = new RealDate();
target.setHours(23, 59, 30, 0);
const offset = target.getTime() - RealDate.now();
class LateNightDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...args);
  }
  static now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = LateNightDate;
