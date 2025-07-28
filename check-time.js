#!/usr/bin/env node

/**
 * System time checker script
 * Run this to check if your system time is correct
 */

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const day = now.getDate();

console.log('🕐 System Time Check');
console.log('==================');
console.log(`Current Date: ${now.toISOString()}`);
console.log(`Local Time: ${now.toString()}`);
console.log(`Year: ${year}`);
console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`Timezone Offset: ${now.getTimezoneOffset()} minutes`);
console.log(`Unix Timestamp: ${now.getTime()}`);

console.log('\n⚠️  Issues Found:');
if (year > 2024) {
  console.log(`❌ Year is ${year} - This seems to be in the future!`);
  console.log('   → Check your system date settings');
}

if (year < 2024) {
  console.log(`❌ Year is ${year} - This seems to be in the past!`);
  console.log('   → Check your system date settings');
}

if (Math.abs(now.getTimezoneOffset()) > 12 * 60) {
  console.log('❌ Timezone offset seems unusual');
  console.log('   → Check your timezone settings');
}

console.log('\n💡 To fix timestamp issues:');
console.log('1. Check system date/time in your OS settings');
console.log('2. Sync with NTP server if possible');
console.log('3. Check MongoDB server time if using remote database');
console.log('4. Restart your Node.js server after fixing system time');

console.log('\n🔧 Commands to fix (depending on your OS):');
console.log('Windows: w32tm /resync');
console.log('Linux: sudo ntpdate -s time.nist.gov');
console.log('macOS: sudo sntp -sS time.apple.com');