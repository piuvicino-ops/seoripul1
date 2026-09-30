(() => {
  'use strict';

  const VERSION = '20260930p1';
  const cfg = window.SAEJEONGI_AUTH_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey || !window.supabase) return;

  const sb = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );

  const API_URL = `${cfg.supabaseUrl}/functions/v1/push-api`;
  let pushConfig = null;
  let membersLoaded = false;

  const css = `
    #webPushBellBtn{
      appearance:none;border:1px solid #cbd5e1;background:#fff;color:#334155;
      border-radius:10px;padding:8px 11px;font-size:12px;font-weight:800;
      cursor:pointer;display:none;align-items:center;gap:5px;line-height:1.1
    }
    #webPushBellBtn:hover{background:#f8fafc}
    #webPushBellBtn .dot{width:7px;height:7px;border-radius:50%;background:#94a3b8}
    #webPushBellBtn.on .dot{background:#22c55e}
    #webPushModal{
      position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.48);
      display:none;align-items:center;justify-content:center;padding:18px
    }
    #webPushModal.open{display:flex}
    #webPushCard{
      width:min(620px,100%);max-height:min(86vh,760px);overflow:auto;
      background:#fff;border-radius:18px;border:1px solid #e2e8f0;
      box-shadow:0 24px 70px rgba(15,23,42,.25);padding:18px
    }
    .wpHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .wpHead h2{margin:0;font-size:19px;line-height:1.35}
    .wpHead p{margin:5px 0 0;font-size:12px;line-height:1.55;color:#64748b}
    .wpClose{
      appearance:none;border:0;background:#f1f5f9;color:#334155;width:34px;height:34px;
      border-radius:50%;font-size:18px;cursor:pointer;flex:0 0 auto
    }
    .wpSection{margin-top:16px;padding:15px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
    .wpSection h3{margin:0 0 9px;font-size:14px}
    .wpStatus{font-size:12.5px;line-height:1.65;color:#475569}
    .wpActions{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}
    .wpBtn{
      appearance:none;border:1px solid #cbd5e1;border-radius:10px;background:#fff;
      color:#334155;padding:9px 12px;font-size:12px;font-weight:850;cursor:pointer
    }
    .wpBtn.primary{background:#4aa3df;border-color:#4aa3df;color:#fff}
    .wpBtn.danger{border-color:#fecaca;color:#b91c1c;background:#fff7f7}
    .wpBtn:disabled{opacity:.55;cursor:not-allowed}
    .wpNote{margin-top:9px;font-size:11px;line-height:1.55;color:#64748b}
    .wpGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .wpField{display:flex;flex-direction:column;gap:5px}
    .wpField.full{grid-column:1/-1}
    .wpField label{font-size:11px;font-weight:800;color:#475569}
    .wpField input,.wpField textarea,.wpField select{
      width:100%;border:1px solid #cbd5e1;border-radius:10px;background:#fff;
      padding:9px 10px;font:inherit;font-size:12.5px;color:#172033
    }
    .wpField textarea{min-height:84px;resize:vertical}
    .wpResult{margin-top:10px;padding:10px 11px;border-radius:10px;background:#f8fafc;
      font-size:12px;line-height:1.55;color:#475569;display:none}
    .wpResult.show{display:block}
    .wpResult.ok{background:#f0fdf4;color:#166534}
    .wpResult.err{background:#fef2f2;color:#991b1b}
    .wpHistory{display:grid;gap:7px}
    .wpHistoryItem{padding:9px 10px;border-radius:10px;background:#f8fafc;font-size:11.5px;line-height:1.5}
    .wpHistoryItem b{display:block;font-size:12px;color:#1e293b}
    @media(max-width:560px){
      #webPushCard{padding:15px;border-radius:16px}
      .wpGrid{grid-template-columns:1fr}
      .wpField.full{grid-column:auto}
    }
  `;

  const style = document.createElement('style');
  style.id = 'webPushUiStyle';
  style.textContent = css;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'webPushModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div id="webPushCard" role="dialog" aria-modal="true" aria-labelledby="webPushTitle">
      <div class="wpHead">
        <div>
          <h2 id="webPushTitle">푸시 알림</h2>
          <p>중요 공지와 일정 안내를 기기 알림으로 받을 수 있습니다.</p>
        </div>
        <button class="wpClose" id="webPushClose" type="button" aria-label="닫기">×</button>
      </div>

      <section class="wpSection">
        <h3>내 알림 설정</h3>
        <div class="wpStatus" id="webPushStatus">알림 상태를 확인하는 중입니다.</div>
        <div class="wpActions">
          <button class="wpBtn primary" id="webPushSubscribe" type="button">알림 받기</button>
          <button class="wpBtn danger" id="webPushUnsubscribe" type="button">알림 끄기</button>
        </div>
        <div class="wpNote" id="webPushNote">
          알림 허용 여부는 이 기기와 브라우저마다 별도로 설정됩니다.
        </div>
      </section>

      <section class="wpSection" id="webPushAdminSection" hidden>
        <h3>관리자 푸시 발송</h3>
        <div class="wpGrid">
          <div class="wpField">
            <label for="webPushTarget">발송 대상</label>
            <select id="webPushTarget">
              <option value="all">전체 승인회원</option>
              <option value="resident">새정이마을주민</option>
              <option value="landowner">일반토지주</option>
              <option value="admin">관리자</option>
              <option value="user">특정 회원</option>
              <option value="self">내 기기 테스트</option>
            </select>
          </div>
          <div class="wpField" id="webPushMemberWrap" hidden>
            <label for="webPushMember">특정 회원</label>
            <select id="webPushMember"><option value="">회원 선택</option></select>
          </div>
          <div class="wpField full">
            <label for="webPushSendTitle">알림 제목</label>
            <input id="webPushSendTitle" maxlength="80" value="서울서리풀1 씹어먹기" />
          </div>
          <div class="wpField full">
            <label for="webPushSendBody">알림 내용</label>
            <textarea id="webPushSendBody" maxlength="240" placeholder="보낼 내용을 입력하세요"></textarea>
          </div>
          <div class="wpField full">
            <label for="webPushSendUrl">누르면 열 페이지</label>
            <input id="webPushSendUrl" maxlength="1000" value="./" placeholder="./ 또는 앱 내부 주소" />
          </div>
        </div>
        <div class="wpActions">
          <button class="wpBtn primary" id="webPushSend" type="button">푸시 발송</button>
          <button class="wpBtn" id="webPushHistoryRefresh" type="button">발송기록 새로고침</button>
        </div>
        <div class="wpResult" id="webPushSendResult"></div>
        <div class="wpNote">
          푸시 발송 권한은 서버에서도 관리자 등급을 다시 확인합니다. 일반 회원이 주소를 직접 호출해도 발송되지 않습니다.
        </div>
      </section>

      <section class="wpSection" id="webPushHistorySection" hidden>
        <h3>최근 발송기록</h3>
        <div class="wpHistory" id="webPushHistory"></div>
      </section>
    </div>
  `;
  document.body.appendChild(modal);

  const bell = document.createElement('button');
  bell.id = 'webPushBellBtn';
  bell.type = 'button';
  bell.innerHTML = '<span class="dot"></span><span>알림</span>';

  const placeBell = () => {
    if (bell.isConnected) return;
    const logout = document.getElementById('memberLogout');
    if (logout?.parentElement) {
      logout.parentElement.insertBefore(bell, logout);
      return;
    }
    const memberBar = document.querySelector('.memberBar, #memberBar, .memberBarActions');
    if (memberBar) {
      memberBar.appendChild(bell);
      return;
    }
    Object.assign(bell.style, {
      position: 'fixed',
      right: '14px',
      bottom: '14px',
      zIndex: '2147483500'
    });
    document.body.appendChild(bell);
  };
  placeBell();

  const el = id => document.getElementById(id);
  const statusEl = el('webPushStatus');
  const subscribeBtn = el('webPushSubscribe');
  const unsubscribeBtn = el('webPushUnsubscribe');
  const adminSection = el('webPushAdminSection');
  const historySection = el('webPushHistorySection');
  const targetEl = el('webPushTarget');
  const memberWrap = el('webPushMemberWrap');
  const memberEl = el('webPushMember');
  const sendResult = el('webPushSendResult');

  const getToken = async () => {
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || '';
  };

  const call = async payload => {
    const token = await getToken();
    if (!token) throw new Error('로그인이 필요합니다.');

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.supabaseAnonKey,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '푸시 요청을 처리할 수 없습니다.');
    return data;
  };

  const urlBase64ToUint8Array = base64String => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(ch => ch.charCodeAt(0)));
  };

  const ensureRegistration = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('이 브라우저는 Service Worker를 지원하지 않습니다.');
    }
    return navigator.serviceWorker.register(`./sw.js?v=${VERSION}`, { scope: './' });
  };

  const currentSubscription = async () => {
    const reg = await ensureRegistration();
    await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  };

  const refreshSubscriptionUi = async () => {
    try {
      if (!('Notification' in window) || !('PushManager' in window)) {
        statusEl.textContent = '이 브라우저에서는 웹 푸시 알림을 사용할 수 없습니다.';
        subscribeBtn.disabled = true;
        unsubscribeBtn.disabled = true;
        bell.classList.remove('on');
        return;
      }

      const sub = await currentSubscription();
      const perm = Notification.permission;

      if (sub && perm === 'granted') {
        statusEl.textContent = '이 기기에서 푸시 알림을 받고 있습니다.';
        bell.classList.add('on');
        subscribeBtn.disabled = true;
        unsubscribeBtn.disabled = false;
      } else if (perm === 'denied') {
        statusEl.textContent = '브라우저에서 알림이 차단되어 있습니다. 브라우저 사이트 설정에서 알림을 허용해 주세요.';
        bell.classList.remove('on');
        subscribeBtn.disabled = true;
        unsubscribeBtn.disabled = !sub;
      } else {
        statusEl.textContent = '이 기기의 푸시 알림이 꺼져 있습니다.';
        bell.classList.remove('on');
        subscribeBtn.disabled = false;
        unsubscribeBtn.disabled = !sub;
      }
    } catch (e) {
      statusEl.textContent = e.message || '알림 상태를 확인하지 못했습니다.';
    }
  };

  const loadConfig = async () => {
    const data = await call({ action: 'config' });
    pushConfig = data;
    adminSection.hidden = !data.is_admin;
    historySection.hidden = !data.is_admin;
    return data;
  };

  const subscribe = async () => {
    subscribeBtn.disabled = true;
    statusEl.textContent = '알림을 설정하는 중입니다.';
    try {
      const c = pushConfig || await loadConfig();
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('알림 권한이 허용되지 않았습니다.');
      }

      const reg = await ensureRegistration();
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(c.public_key)
        });
      }

      await call({
        action: 'subscribe',
        subscription: sub.toJSON(),
        user_agent: navigator.userAgent
      });

      await refreshSubscriptionUi();
    } catch (e) {
      statusEl.textContent = e.message || '알림 설정에 실패했습니다.';
      subscribeBtn.disabled = false;
    }
  };

  const unsubscribe = async () => {
    unsubscribeBtn.disabled = true;
    try {
      const sub = await currentSubscription();
      if (sub) {
        try {
          await call({ action: 'unsubscribe', endpoint: sub.endpoint });
        } finally {
          await sub.unsubscribe();
        }
      }
      await refreshSubscriptionUi();
    } catch (e) {
      statusEl.textContent = e.message || '알림 해제에 실패했습니다.';
      unsubscribeBtn.disabled = false;
    }
  };

  const roleLabel = role => ({
    resident: '새정이마을주민',
    landowner: '일반토지주',
    admin: '관리자'
  }[role] || role || '');

  const loadMembers = async () => {
    if (membersLoaded) return;
    const data = await call({ action: 'admin_members' });
    const items = data.members || [];
    memberEl.innerHTML =
      '<option value="">회원 선택</option>' +
      items.map(m => {
        const count = Number(m.push_count || 0);
        return `<option value="${String(m.user_id).replace(/"/g, '&quot;')}">${String(m.full_name || '회원')} · ${roleLabel(m.membership_role)} · 알림기기 ${count}</option>`;
      }).join('');
    membersLoaded = true;
  };

  const fmtDate = iso => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const loadHistory = async () => {
    const box = el('webPushHistory');
    box.innerHTML = '<div class="wpStatus">불러오는 중입니다.</div>';
    try {
      const data = await call({ action: 'admin_history' });
      const rows = data.messages || [];
      box.innerHTML = rows.length ? rows.slice(0, 10).map(m => `
        <div class="wpHistoryItem">
          <b>${String(m.title || '')}</b>
          ${fmtDate(m.sent_at)} · 대상 ${String(m.target_role || '')}<br>
          성공 ${Number(m.success_count || 0)} / 전체 ${Number(m.subscription_count || 0)}
          ${Number(m.failure_count || 0) ? ` · 실패 ${Number(m.failure_count || 0)}` : ''}
        </div>
      `).join('') : '<div class="wpStatus">아직 발송기록이 없습니다.</div>';
    } catch (e) {
      box.innerHTML = `<div class="wpStatus">${String(e.message || '발송기록을 불러오지 못했습니다.')}</div>`;
    }
  };

  const sendPush = async () => {
    const btn = el('webPushSend');
    const title = el('webPushSendTitle').value.trim();
    const body = el('webPushSendBody').value.trim();
    const url = el('webPushSendUrl').value.trim() || './';
    const target = targetEl.value;
    const targetUserId = memberEl.value;

    sendResult.className = 'wpResult show';
    sendResult.textContent = '발송 중입니다.';
    btn.disabled = true;

    try {
      const data = await call({
        action: 'send',
        target,
        target_user_id: targetUserId,
        title,
        body,
        url
      });

      sendResult.className = 'wpResult show ok';
      sendResult.textContent =
        `발송 완료: 대상 기기 ${Number(data.subscription_count || 0)}대, 성공 ${Number(data.success_count || 0)}대, 실패 ${Number(data.failure_count || 0)}대`;

      await loadHistory();
    } catch (e) {
      sendResult.className = 'wpResult show err';
      sendResult.textContent = e.message || '푸시 발송에 실패했습니다.';
    } finally {
      btn.disabled = false;
    }
  };

  const openModal = async () => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    try {
      await loadConfig();
      await refreshSubscriptionUi();
      if (pushConfig?.is_admin) loadHistory();
    } catch (e) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      alert(e.message || '로그인 상태를 확인할 수 없습니다.');
    }
  };

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  bell.addEventListener('click', openModal);
  el('webPushClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  subscribeBtn.addEventListener('click', subscribe);
  unsubscribeBtn.addEventListener('click', unsubscribe);
  el('webPushSend').addEventListener('click', sendPush);
  el('webPushHistoryRefresh').addEventListener('click', loadHistory);

  targetEl.addEventListener('change', async () => {
    const isUser = targetEl.value === 'user';
    memberWrap.hidden = !isUser;
    if (isUser) {
      try {
        await loadMembers();
      } catch (e) {
        sendResult.className = 'wpResult show err';
        sendResult.textContent = e.message || '회원목록을 불러오지 못했습니다.';
      }
    }
  });

  const syncLoginVisibility = async () => {
    try {
      const token = await getToken();
      if (!token) {
        bell.style.display = 'none';
        pushConfig = null;
        return;
      }
      const data = await call({ action: 'config' });
      pushConfig = data;
      bell.style.display = 'inline-flex';
      adminSection.hidden = !data.is_admin;
      historySection.hidden = !data.is_admin;
      refreshSubscriptionUi();
    } catch {
      bell.style.display = 'none';
      pushConfig = null;
    }
  };

  sb.auth.onAuthStateChange(() => {
    setTimeout(syncLoginVisibility, 100);
  });

  window.addEventListener('pageshow', syncLoginVisibility);
  window.addEventListener('focus', syncLoginVisibility);

  setTimeout(syncLoginVisibility, 300);
  setInterval(syncLoginVisibility, 5000);
})();
