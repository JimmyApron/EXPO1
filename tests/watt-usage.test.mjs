import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.expo/workspace-verification/node_modules/@electric-sql/pglite/dist/index.js';

const user = '10000000-0000-0000-0000-000000000001';
const project = '20000000-0000-0000-0000-000000000001';
const source = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('Watt migration keeps balances and enforces free text, replay, and trial activation boundaries', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create table public.rooms(id uuid primary key,ownerid uuid,name text);
      create table public.roommembers(id uuid primary key default gen_random_uuid(),roomid uuid,userid uuid);
      create table public.projects(id uuid primary key,userid uuid,roomid uuid);
    `);
    await db.exec(await source('20261017030000_watt_entitlements_and_usage.sql'));
    const renewal = (await source('20261017120000_watt_auto_renewal_realtime.sql'))
      .replace(/create extension if not exists pg_cron[\s\S]*$/i, '');
    await db.exec(renewal);
    await db.query('insert into auth.users(id) values($1)', [user]);
    await db.query('insert into public.projects(id,userid) values($1,$2)', [project,user]);
    const legacyId='30000000-0000-0000-0000-000000000099';
    await db.query(`insert into public.watt_usage(request_id,user_id,project_id,feature,units,state,created_at)
      values($1,$2,$3,'legacy-text',1,'succeeded',now()-interval '1 day')`,[legacyId,user,project]);
    const policy = (await source('20261022100000_watt_text_usage_policy.sql'))
      .replace(/do \$\$\nbegin\n  if exists\(select 1 from cron\.job where jobname='watt-usage-recovery'\)[\s\S]*?end \$\$;/i, '');
    await db.exec(policy);
    assert.equal((await db.query('select usage_kind,units from public.watt_usage where request_id=$1',[legacyId])).rows[0].usage_kind,'unit_charge');
    assert.equal((await db.query("select remaining_units from public.watt_grants where owner_id=$1 and source='signup'",[user])).rows[0].remaining_units,12);
    await assert.rejects(db.query("select public.watt_activate($1,'trial_personal',null,false)",[user]),/invalid_product/);
    const activation = await db.query("select public.watt_activate($1,'personal_30',null,false) as result",[user]);
    assert.equal(activation.rows[0].result.units,100);
    await db.query("update public.watt_grants set remaining_units=0 where owner_id=$1 and source='recurring'",[user]);
    const id = '30000000-0000-0000-0000-000000000001';
    const args = [user,id,'analyze-idea-draft',project,null,1,'a'.repeat(64),false];
    const reserve = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',args);
    assert.equal(reserve.rows[0].result.units,0);
    assert.equal(reserve.rows[0].result.usage_kind,'subscription_free');
    const usageId = reserve.rows[0].result.usage_id;
    const settled = await db.query('select public.watt_settle_usage($1,true,null,200,$2) as result',[usageId,'{"ok":true}']);
    assert.equal(settled.rows[0].result.state,'succeeded');
    const replay = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',args);
    assert.equal(replay.rows[0].result.response_body,'{"ok":true}');
    assert.equal((await db.query('select count(*)::int as n from public.watt_usage')).rows[0].n,2);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select response_body from public.watt_usage_responses'),/permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8)',[...args.slice(0,6),'b'.repeat(64),false]),/request_id_conflict/);
    const image = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [user,'30000000-0000-0000-0000-000000000002','extract-candidate-ideas-image',project,null,5,'c'.repeat(64),false]);
    assert.equal(image.rows[0].result.units,5);
    assert.equal(image.rows[0].result.usage_kind,'unit_charge');
    assert.equal((await db.query("select remaining_units from public.watt_grants where owner_id=$1 and source='signup'",[user])).rows[0].remaining_units,7);
    await db.query('select public.watt_settle_usage($1,false,$2)',[image.rows[0].result.usage_id,'provider_error']);
    assert.equal((await db.query("select remaining_units from public.watt_grants where owner_id=$1 and source='signup'",[user])).rows[0].remaining_units,12);

    await db.query(`insert into public.watt_usage(request_id,user_id,project_id,feature,units,state,usage_kind,created_at)
      select gen_random_uuid(),$1,$2,'analyze-idea-draft',0,'succeeded','subscription_free',now()-interval '2 minutes'
      from generate_series(1,39)`,[user,project]);
    const fortyFirst = [user,'30000000-0000-0000-0000-000000000003','analyze-idea-draft',project,null,1,'d'.repeat(64),false];
    const consent = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',fortyFirst);
    assert.equal(consent.rows[0].result.consent_required,true);
    assert.equal(consent.rows[0].result.units,1);
    const charged = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [...fortyFirst.slice(0,7),true]);
    assert.equal(charged.rows[0].result.usage_kind,'limit_charge');
    assert.equal(charged.rows[0].result.units,1);
    await db.query('select public.watt_settle_usage($1,true,null,200,$2)',[charged.rows[0].result.usage_id,'{}']);
    await db.query("update public.watt_usage set created_at=created_at-interval '1 day' where units=0 and user_id=$1",[user]);
    const afterMidnight = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [user,'30000000-0000-0000-0000-000000000004','analyze-idea-draft',project,null,1,'e'.repeat(64),false]);
    assert.equal(afterMidnight.rows[0].result.units,0);
    await assert.rejects(db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8)',
      [user,'30000000-0000-0000-0000-000000000005','analyze-idea-draft',project,null,1,'f'.repeat(64),false]),/execution_limit/);
    await db.query('select public.watt_settle_usage($1,false,$2)',[afterMidnight.rows[0].result.usage_id,'provider_error']);

    const trialUser='10000000-0000-0000-0000-000000000002';
    await db.query('insert into auth.users(id) values($1)',[trialUser]);
    const trial = await db.query("select public.watt_start_trial($1,'personal',null) as result",[trialUser]);
    assert.equal(trial.rows[0].result.units,20);
    await assert.rejects(db.query("select public.watt_start_trial($1,'personal',null)",[trialUser]),/trial_already_used/);
    await db.query(`insert into public.watt_usage(request_id,user_id,feature,units,state,usage_kind,entitlement_id,created_at)
      select gen_random_uuid(),$1,'analyze-idea-draft',0,'succeeded','trial_free',$2,now()-interval '2 minutes'
      from generate_series(1,10)`,[trialUser,trial.rows[0].result.entitlement_id]);
    const trialLimit = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [trialUser,'30000000-0000-0000-0000-000000000006','analyze-idea-draft',null,null,1,'1'.repeat(64),false]);
    assert.equal(trialLimit.rows[0].result.consent_required,true);
    await db.query("update public.watt_usage set created_at=created_at-interval '1 day' where user_id=$1 and usage_kind='trial_free'",[trialUser]);
    await db.query(`insert into public.watt_usage(request_id,user_id,feature,units,state,usage_kind,entitlement_id,created_at)
      select gen_random_uuid(),$1,'analyze-idea-draft',0,'succeeded','trial_free',$2,now()-interval '1 day'
      from generate_series(1,15)`,[trialUser,trial.rows[0].result.entitlement_id]);
    const personalTrialTotal=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [trialUser,crypto.randomUUID(),'analyze-idea-draft',null,null,1,'2'.repeat(64),false]);
    assert.equal(personalTrialTotal.rows[0].result.consent_required,true);

    const room='40000000-0000-0000-0000-000000000001';
    const roomTwo='40000000-0000-0000-0000-000000000002';
    const teamProject='20000000-0000-0000-0000-000000000002';
    await db.query('insert into public.rooms(id,ownerid,name) values($1,$3,$4),($2,$3,$5)',[room,roomTwo,user,'A','B']);
    await db.query('insert into public.roommembers(roomid,userid) values($1,$3),($2,$3),($1,$4),($2,$4)',[room,roomTwo,user,trialUser]);
    await db.query('insert into public.projects(id,userid,roomid) values($1,$2,$3)',[teamProject,user,room]);
    await db.query("select public.watt_activate($1,'team_30',$2,false)",[user,room]);
    await db.query("select public.watt_activate($1,'team_30',$2,false)",[user,roomTwo]);
    await db.query(`insert into public.watt_usage(request_id,user_id,project_id,room_id,feature,units,state,usage_kind,created_at)
      select gen_random_uuid(),$1,$2,$3,'analyze-idea-draft',0,'succeeded','subscription_free',now()-interval '2 minutes'
      from generate_series(1,40)`,[user,teamProject,room]);
    const teamMember = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [trialUser,'30000000-0000-0000-0000-000000000007','analyze-idea-draft',teamProject,room,1,'2'.repeat(64),false]);
    assert.equal(teamMember.rows[0].result.units,0,'another member has an independent 40-call quota');
    await db.query('select public.watt_settle_usage($1,true,null,200,$2)',[teamMember.rows[0].result.usage_id,'{}']);
    const ownerLimit = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [user,'30000000-0000-0000-0000-000000000008','analyze-idea-draft',teamProject,room,1,'3'.repeat(64),false]);
    assert.equal(ownerLimit.rows[0].result.consent_required,true,'owner cannot borrow a teammate quota');
    const secondRoom = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [user,'30000000-0000-0000-0000-000000000009','analyze-idea-draft',null,roomTwo,1,'4'.repeat(64),false]);
    assert.equal(secondRoom.rows[0].result.units,0,'another room has its own quota');
    await db.query('select public.watt_settle_usage($1,true,null,200,$2)',[secondRoom.rows[0].result.usage_id,'{}']);
    for (let n=11; n<=12; n++) {
      const next = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
        [user,`30000000-0000-0000-0000-${String(n).padStart(12,'0')}`,'analyze-idea-draft',null,roomTwo,1,'6'.repeat(64),false]);
      await db.query('select public.watt_settle_usage($1,true,null,200,$2)',[next.rows[0].result.usage_id,'{}']);
    }
    await assert.rejects(db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8)',
      [user,'30000000-0000-0000-0000-000000000013','analyze-idea-draft',null,roomTwo,1,'7'.repeat(64),false]),/rate_limited/);
    const slotUsers=[3,4,5].map(n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`);
    for (const member of slotUsers) {
      await db.query('insert into auth.users(id) values($1)',[member]);
      await db.query('insert into public.roommembers(roomid,userid) values($1,$2)',[roomTwo,member]);
      const slot = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
        [member,crypto.randomUUID(),'analyze-idea-draft',null,roomTwo,1,'8'.repeat(64),false]);
      assert.equal(slot.rows[0].result.units,0);
    }
    await assert.rejects(db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8)',
      [trialUser,'30000000-0000-0000-0000-000000000014','analyze-idea-draft',null,roomTwo,1,'9'.repeat(64),false]),/execution_limit/);
    await db.query(`insert into public.watt_usage(request_id,user_id,room_id,feature,units,state,usage_kind,created_at)
      select gen_random_uuid(),$1,$2,'analyze-idea-draft',0,'succeeded','subscription_free',now()-interval '2 minutes'
      from generate_series(1,79)`,[trialUser,room]);
    const teamLimit = await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [trialUser,'30000000-0000-0000-0000-000000000010','analyze-idea-draft',teamProject,room,1,'5'.repeat(64),false]);
    assert.equal(teamLimit.rows[0].result.consent_required,true,'team room stops at 120 free calls');

    const renewalUser='10000000-0000-0000-0000-000000000006';
    await db.query('insert into auth.users(id) values($1)',[renewalUser]);
    const renewed=await db.query("select public.watt_activate($1,'personal_30',null,false) as result",[renewalUser]);
    await db.query(`update public.watt_entitlements set started_at=started_at-interval '31 days',
      ends_at=ends_at-interval '31 days',next_renewal_at=next_renewal_at-interval '31 days'
      where id=$1`,[renewed.rows[0].result.entitlement_id]);
    await db.query('select public.watt_balance($1,null)',[renewalUser]);
    const renewedState=(await db.query('select state,auto_renew,period_number,ends_at from public.watt_entitlements where id=$1',
      [renewed.rows[0].result.entitlement_id])).rows[0];
    assert.equal(renewedState.state,'active');
    assert.equal(renewedState.period_number,1);
    assert.equal(renewedState.auto_renew,true);
    assert.ok(new Date(renewedState.ends_at)>new Date());
    await db.query('select public.watt_cancel($1,$2)',[renewalUser,renewed.rows[0].result.entitlement_id]);
    const cancellationBenefit=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [renewalUser,crypto.randomUUID(),'analyze-idea-draft',null,null,1,'e'.repeat(64),false]);
    assert.equal(cancellationBenefit.rows[0].result.units,0);
    await db.query('select public.watt_settle_usage($1,true,null,200,$2)',[cancellationBenefit.rows[0].result.usage_id,'{}']);
    await db.query("update public.watt_entitlements set ends_at=now()-interval '1 second' where id=$1",[renewed.rows[0].result.entitlement_id]);
    await db.query('select public.watt_process_renewals()');
    const expiredBenefit=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [renewalUser,crypto.randomUUID(),'analyze-idea-draft',null,null,1,'f'.repeat(64),false]);
    assert.equal(expiredBenefit.rows[0].result.units,1);

    const cycleUser='10000000-0000-0000-0000-000000000007';
    await db.query('insert into auth.users(id) values($1)',[cycleUser]);
    const long=await db.query("select public.watt_activate($1,'personal_120',null,false) as result",[cycleUser]);
    await db.query(`update public.watt_entitlements set started_at=started_at-interval '31 days',
      ends_at=ends_at-interval '31 days',next_renewal_at=next_renewal_at-interval '31 days'
      where id=$1`,[long.rows[0].result.entitlement_id]);
    const balance=await db.query('select public.watt_balance($1,null) as result',[cycleUser]);
    const nextGrant=balance.rows[0].result.entitlements[0].next_grant_at;
    assert.ok(new Date(nextGrant)>new Date(),'next grant follows the current 30-day cycle');
    assert.equal((await db.query("select count(*)::int as n from public.watt_grants where owner_id=$1 and source='recurring'",[cycleUser])).rows[0].n,2);

    const teamTrialOwner='10000000-0000-0000-0000-000000000008';
    const teamTrialRoom='40000000-0000-0000-0000-000000000003';
    await db.query('insert into auth.users(id) values($1)',[teamTrialOwner]);
    await db.query('insert into public.rooms(id,ownerid,name) values($1,$2,$3)',[teamTrialRoom,teamTrialOwner,'Trial']);
    await db.query('insert into public.roommembers(roomid,userid) values($1,$2)',[teamTrialRoom,teamTrialOwner]);
    const teamTrial=await db.query("select public.watt_start_trial($1,'team',$2) as result",[teamTrialOwner,teamTrialRoom]);
    assert.equal(teamTrial.rows[0].result.units,60);
    await db.query(`insert into public.watt_usage(request_id,user_id,room_id,feature,units,state,usage_kind,entitlement_id,created_at)
      select gen_random_uuid(),$1,$2,'analyze-idea-draft',0,'succeeded','trial_free',$3,now()-interval '2 minutes'
      from generate_series(1,30)`,[teamTrialOwner,teamTrialRoom,teamTrial.rows[0].result.entitlement_id]);
    const trialTeamLimit=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [teamTrialOwner,crypto.randomUUID(),'analyze-idea-draft',null,teamTrialRoom,1,'a'.repeat(64),false]);
    assert.equal(trialTeamLimit.rows[0].result.consent_required,true);
    await db.query("update public.watt_usage set created_at=created_at-interval '1 day' where room_id=$1",[teamTrialRoom]);
    await db.query(`insert into public.watt_usage(request_id,user_id,room_id,feature,units,state,usage_kind,entitlement_id,created_at)
      select gen_random_uuid(),$1,$2,'analyze-idea-draft',0,'succeeded','trial_free',$3,now()-interval '1 day'
      from generate_series(1,45)`,[teamTrialOwner,teamTrialRoom,teamTrial.rows[0].result.entitlement_id]);
    const trialTotalLimit=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [teamTrialOwner,crypto.randomUUID(),'analyze-idea-draft',null,teamTrialRoom,1,'b'.repeat(64),false]);
    assert.equal(trialTotalLimit.rows[0].result.consent_required,true);

    const freeUser='10000000-0000-0000-0000-000000000009';
    await db.query('insert into auth.users(id) values($1)',[freeUser]);
    const freeUsage=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [freeUser,crypto.randomUUID(),'generate-mvp',null,null,2,'c'.repeat(64),false]);
    assert.equal(freeUsage.rows[0].result.units,2);
    assert.equal(freeUsage.rows[0].result.usage_kind,'unit_charge');
    await db.query('select public.watt_settle_usage($1,true,null,200,$2)',[freeUsage.rows[0].result.usage_id,'{}']);
    assert.equal((await db.query("select remaining_units from public.watt_grants where owner_id=$1 and source='signup'",[freeUser])).rows[0].remaining_units,10);
    await db.query("select public.watt_add_topup($1,'topup_s',null,$2)",[freeUser,crypto.randomUUID()]);
    await db.query('update public.watt_grants set remaining_units=0 where owner_id=$1 and source=$2',[freeUser,'signup']);
    const topupUsage=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [freeUser,crypto.randomUUID(),'analyze-idea-draft',null,null,1,'d'.repeat(64),false]);
    assert.equal(topupUsage.rows[0].result.units,1);
    assert.equal((await db.query("select remaining_units from public.watt_grants where owner_id=$1 and source='topup'",[freeUser])).rows[0].remaining_units,9);

    const abnormalUser='10000000-0000-0000-0000-000000000010';
    await db.query('insert into auth.users(id) values($1)',[abnormalUser]);
    await db.query(`insert into public.watt_entitlements(user_id,product_id,state,ends_at,trial)
      values($1,'trial_personal','active',now()+interval '7 days',false)`,[abnormalUser]);
    const abnormalUsage=await db.query('select public.watt_reserve_usage($1,$2,$3,$4,$5,$6,$7,$8) as result',
      [abnormalUser,crypto.randomUUID(),'analyze-idea-draft',null,null,1,'e'.repeat(64),false]);
    assert.equal(abnormalUsage.rows[0].result.units,1,'a malformed old trial is never treated as paid');
  } finally { await db.close(); }
});
