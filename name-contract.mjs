
 function clean(v){return typeof v==='string'?v.normalize('NFC').trim().replace(/\s+/g,' '):'';}
 function part(v){var s=clean(v);if(!s||s.length>60||!/[\p{L}]/u.test(s)||/[\p{Cc}\p{Cf}<>]/u.test(s))throw Error('invalid_parent_name');return s;}
 function normalize(p){
  var split=p.parent_name_version===2||p.parent_first_name!==undefined||p.parent_last_name!==undefined;
  var full;
  if(split){var first=part(p.parent_first_name),last=part(p.parent_last_name);full=first+' '+last;}
  else {full=clean(p.parent_name);if(!full||full.length>80||!/^\S+\s+\S/.test(full)||/[\p{Cc}\p{Cf}<>]/u.test(full))throw Error('parent_full_name_required');}
  if(full.length>80)throw Error('invalid_parent_name');
  return full;
 }
export const ParentNameContract={normalize};
