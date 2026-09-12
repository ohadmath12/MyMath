'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'Code.gs'), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'Code.gs' });

assert.strictEqual(context.normalizeIsraeliId_('123456782'), '123456782');
assert.strictEqual(context.normalizeIsraeliId_(' 123-456-782 '), '123456782');
assert.throws(() => context.normalizeIsraeliId_('123456789'));
assert.throws(() => context.normalizeIsraeliId_('abc123456782'));

assert.strictEqual(context.isValidEmail_('parent@example.com'), true);
assert.strictEqual(context.isValidEmail_('not-an-email'), false);

assert.strictEqual(context.ALLOWED_SCHOOLS_.includes('חטיבת שז"ר, קריית אונו'), true);
assert.strictEqual(context.SHEET_HEADERS_.slice(19, 23).join(','),
  'crm_sync_status,crm_synced_at,crm_student_id,crm_sync_error');
assert.strictEqual(context.SHEET_HEADERS_[23], 'client_submission_id');
assert.strictEqual(context.SHEET_HEADERS_[24], 'parent_phone');

assert.strictEqual(context.readPngUint32_([0, 0, 2, 0], 0), 512);

const strictProperties = {
  getProperty(name) {
    return name === 'API_GATEWAY_SECRET' ? 'test-secret' : 'false';
  }
};
const gatewayPayload = { student_first_name: 'בדיקה' };
assert.strictEqual(
  context.extractRegistrationPayload_({ gateway_secret: 'test-secret', payload: gatewayPayload }, strictProperties),
  gatewayPayload
);
assert.throws(() => context.extractRegistrationPayload_({ student_first_name: 'בדיקה' }, strictProperties));

const transitionProperties = { getProperty() { return null; } };
const legacyPayload = { student_first_name: 'בדיקה ישנה' };
assert.strictEqual(context.extractRegistrationPayload_(legacyPayload, transitionProperties), legacyPayload);

console.log('Security validation tests passed.');
