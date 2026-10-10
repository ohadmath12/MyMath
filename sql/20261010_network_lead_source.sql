-- Run in one transaction. Guard the exact live definition inspected on 10/10.
-- No schema/access change; old public-form fingerprints and source stay unchanged.
do $patch$
declare d text; changed text;
begin
 d := pg_get_functiondef('public.intake_public_lead(jsonb)'::regprocedure);
 if md5(d) <> '7c4f54181ccc45e500ca9f1f41927c47' then
   raise exception 'intake_public_lead changed: inspect current source before migration';
 end if;
 changed := replace(d,
   'jsonb_build_array(n,p,f,z,g,school,availability,email)::text',
   '(jsonb_build_array(n,p,f,z,g,school,availability,email) || case when payload->>''intake_channel''=''network_landing'' then jsonb_build_array(''network_landing'') else ''[]''::jsonb end)::text');
 changed := replace(changed,
   'availability,parent_email,details_completed_at)',
   'availability,parent_email,details_completed_at,referral_source)');
 changed := replace(changed,
   'availability,nullif(email,''''),now()) returning',
   'availability,nullif(email,''''),now(),case when payload->>''intake_channel''=''network_landing'' then ''דף הנחיתה'' else null end) returning');
 changed := replace(changed,
   '''פנייה מהטופס הציבורי'');',
   'case when payload->>''intake_channel''=''network_landing'' then ''פנייה מדף הנחיתה'' else ''פנייה מהטופס הציבורי'' end);');
 changed := replace(changed,
   '''פנייה נוספת מהטופס הציבורי — לבדיקה מול ההורה. שם הורה: ''||n',
   '(case when payload->>''intake_channel''=''network_landing'' then ''פנייה נוספת מדף הנחיתה'' else ''פנייה נוספת מהטופס הציבורי'' end)||'' — לבדיקה מול ההורה. שם הורה: ''||n');
 if changed=d or position('details_completed_at,referral_source)' in changed)=0
   or position('then ''דף הנחיתה'' else null' in changed)=0
   or position('פנייה מדף הנחיתה' in changed)=0
   or position('פנייה נוספת מדף הנחיתה' in changed)=0
   or position('jsonb_build_array(''network_landing'')' in changed)=0 then
   raise exception 'source patch incomplete';
 end if;
 execute changed;
end $patch$;
