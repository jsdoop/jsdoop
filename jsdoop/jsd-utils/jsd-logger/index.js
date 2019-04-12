class JSDLogger {
  
  constructor() {
    this.errorLevel = 0;
    this.warnLevel = 1;
    this.infoLevel = 5;
    this.debugLevel = 10;

    this.verbosity = 10;
    this._id = "";
  }

  error(msg) {
    if (this.errorLevel <= this.verbosity) {
      console.error("ERROR" + this._id + ": " + msg);
    }
  }

  warn(msg) {
    if (this.warnLevel <= this.verbosity) {
      console.warn("WARN" + this._id + ": " + msg);
    }
  }


  info(msg) {
    if (this.infoLevel <= this.verbosity) {
      console.info("INFO" + this._id + ": " + msg);
    }
  }

  debug(msg) {
    if (this.debugLevel <= this.verbosity) { 
      console.debug("DEBUG" + this._id + ": " + msg);
    }
  }

  setId(id) {
    if(id) {
      this._id = " (" + id + ")";
    }
  }

  log(msg, level) {
    if (level === undefined) level = this.infoLevel;
    console.log("level = " + level);
    if (level <= this.verbosity) {
      console.log("LOG" + this._id + ": " + msg);
    }
  }
  
}

const logger = new JSDLogger();

module.exports.logger = logger;
