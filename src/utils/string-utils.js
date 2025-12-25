class StringUtils {
  constructor() {

  }
  toCamelCase(str) {
// Check if the input string is empty
    if (str.length === 0) {
      return str;
    }
    return str.replace(/([a-zA-Z]).*/, function (match, chr) {
      // The captured character (chr) is converted to uppercase
      return chr.toUpperCase() + match.substring(1);
    });
  }
}
module.exports = { StringUtils };