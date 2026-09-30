(() => {
  'use strict';

  const VERSION = '20261001p6';
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
  let inboxItems = [];
  let isInboxOpen = false;

  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const style = document.createElement('style');
  style.textContent = `
    #pushBellBtn{
      position:fixed;right:14px;bottom:18px;z-index:2147483500;
      width:44px;height:44px;border-radius:50%;border:1px solid #cbd5e1;
      background:#fff;color:#334155;display:none;align-items:center;justify-content:center;
      cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.16)
    }
    #pushBellBtn:hover{background:#f8fafc}
    #pushBellBtn svg{width:21px;height:21px}
    #pushBellBadge{
      position:absolute;right:-2px;top:-3px;min-width:18px;height:18px;padding:0 4px;
      border-radius:9px;background:#ef4444;color:#fff;border:2px solid #fff;
      display:none;align-items:center;justify-content:center;font-size:10px;font-weight:900;
      line-height:1;box-sizing:border-box
    }
    #pushInboxModal{
      position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.46);
      display:none;align-items:center;justify-content:center;padding:16px
    }
    #pushInboxModal.open{display:flex}
    #pushInboxCard{
      width:min(620px,100%);max-height:min(88vh,820px);overflow:hidden;
      display:flex;flex-direction:column;background:#fff;border:1px solid #e2e8f0;
      border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.24)
    }
    .piHead{
      display:flex;align-items:center;gap:8px;padding:15px 16px;
      border-bottom:1px solid #e2e8f0
    }
    .piHeadTitle{font-size:18px;font-weight:900;color:#172033;margin-right:auto}
    .piHeadCount{font-size:11px;font-weight:850;color:#64748b}
    .piIconBtn,.piTextBtn{
      appearance:none;border:0;background:#f1f5f9;color:#475569;
      cursor:pointer;border-radius:10px;font-weight:800
    }
    .piIconBtn{width:34px;height:34px;display:flex;align-items:center;justify-content:center;padding:0}
    .piIconBtn svg{width:18px;height:18px}
    .piTextBtn{padding:8px 10px;font-size:11px}
    .piBody{overflow:auto;padding:12px}
    #pushBanner{
      display:none;align-items:center;gap:8px;padding:10px 11px;margin-bottom:10px;
      border-radius:11px;background:#f8fafc;border:1px solid #e2e8f0;
      font-size:11.5px;color:#475569
    }
    #pushBanner.show{display:flex}
    #pushBanner span{margin-right:auto}
    #pushBanner button{
      appearance:none;border:1px solid #bae6fd;background:#eff8ff;color:#0369a1;
      padding:6px 9px;border-radius:8px;font-size:11px;font-weight:900;cursor:pointer
    }
    #pushSettings{
      display:none;margin-bottom:10px;padding:12px;border:1px solid #e2e8f0;
      border-radius:12px;background:#fff
    }
    #pushSettings.open{display:block}
    .piSectionTitle{font-size:13px;font-weight:900;color:#1e293b;margin:0 0 7px}
    .piStatus{font-size:11.5px;line-height:1.6;color:#64748b}
    .piActions{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
    .piBtn{
      appearance:none;border:1px solid #cbd5e1;border-radius:9px;background:#fff;
      color:#334155;padding:8px 10px;font-size:11.5px;font-weight:850;cursor:pointer
    }
    .piBtn.primary{background:#4aa3df;border-color:#4aa3df;color:#fff}
    .piBtn.danger{border-color:#fecaca;background:#fff7f7;color:#b91c1c}
    .piBtn:disabled{opacity:.5;cursor:not-allowed}
    #pushInboxList{display:grid;gap:7px}
    .piEmpty{padding:34px 12px;text-align:center;color:#94a3b8;font-size:12px}
    .piItem{
      position:relative;border:1px solid #e2e8f0;border-radius:12px;padding:11px 12px;
      background:#fff;cursor:pointer
    }
    .piItem:hover{background:#f8fafc}
    .piItem.unread{border-color:#bae6fd;background:#f8fcff}
    .piUnreadDot{
      position:absolute;right:11px;top:12px;width:7px;height:7px;border-radius:50%;
      background:#0ea5e9
    }
    .piItemTitle{font-size:12.5px;font-weight:900;color:#1e293b;padding-right:16px}
    .piItemBody{margin-top:4px;font-size:11.5px;line-height:1.55;color:#475569}
    .piItemTime{margin-top:6px;font-size:10.5px;color:#94a3b8}
    #pushAdminToggle{
      display:none;width:100%;margin-top:11px;appearance:none;border:1px solid #cbd5e1;
      background:#fff;color:#334155;border-radius:10px;padding:9px 11px;
      font-size:11.5px;font-weight:900;cursor:pointer
    }
    #pushAdminPanel{
      display:none;margin-top:9px;padding:12px;border:1px solid #e2e8f0;
      border-radius:12px;background:#fff
    }
    #pushAdminPanel.open{display:block}
    .piGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .piField{display:flex;flex-direction:column;gap:4px}
    .piField.full{grid-column:1/-1}
    .piField label{font-size:10.5px;font-weight:850;color:#64748b}
    .piField input,.piField textarea,.piField select{
      width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;
      padding:8px 9px;font:inherit;font-size:11.5px;color:#172033;background:#fff
    }
    .piField textarea{min-height:74px;resize:vertical}
    #pushSendResult{
      display:none;margin-top:8px;padding:8px 9px;border-radius:9px;
      font-size:11px;line-height:1.5
    }
    #pushSendResult.show{display:block;background:#f8fafc;color:#475569}
    #pushSendResult.ok{display:block;background:#f0fdf4;color:#166534}
    #pushSendResult.err{display:block;background:#fef2f2;color:#991b1b}
    @media(max-width:560px){
      #pushInboxCard{border-radius:16px;max-height:90vh}
      .piGrid{grid-template-columns:1fr}
      .piField.full{grid-column:auto}
      .piHead{padding:13px}
      .piHeadTitle{font-size:17px}
    }
  `;
  document.head.appendChild(style);

  const bell = document.createElement('button');
  bell.id = 'pushBellBtn';
  bell.type = 'button';
  bell.setAttribute('aria-label', '알림함');
  bell.title = '알림함';
  bell.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22a2.4 2.4 0 0 0 2.3-1.7H9.7A2.4 2.4 0 0 0 12 22Zm7-5.2-1.5-1.9V10a5.6 5.6 0 0 0-4.2-5.4V4a1.3 1.3 0 1 0-2.6 0v.6A5.6 5.6 0 0 0 6.5 10v4.9L5 16.8a1 1 0 0 0 .8 1.7h12.4a1 1 0 0 0 .8-1.7Z" fill="currentColor"/>
    </svg>
    <span id="pushBellBadge"></span>
  `;
  document.body.appendChild(bell);

  const modal = document.createElement('div');
  modal.id = 'pushInboxModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div id="pushInboxCard" role="dialog" aria-modal="true" aria-labelledby="pushInboxTitle">
      <div class="piHead">
        <div class="piHeadTitle" id="pushInboxTitle">알림함</div>
        <div class="piHeadCount" id="pushInboxCount"></div>
        <button class="piTextBtn" id="pushMarkAll" type="button">모두 읽음</button>
        <button class="piIconBtn" id="pushSettingsBtn" type="button" aria-label="알림 설정" title="알림 설정">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8.6 8.6 0 0 0-1.7-1L15 3.4h-4L10.6 6a8.6 8.6 0 0 0-1.7 1L6.5 6l-2 3.5 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8.6 8.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8.6 8.6 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5ZM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5Z" fill="currentColor"/>
          </svg>
        </button>
        <button class="piIconBtn" id="pushCloseBtn" type="button" aria-label="닫기" title="닫기">×</button>
      </div>

      <div class="piBody">
        <div id="pushBanner">
          <span id="pushBannerText"></span>
          <button id="pushBannerAction" type="button">켜기</button>
        </div>

        <div id="pushSettings">
          <div class="piSectionTitle">푸시 수신 설정</div>
          <div class="piStatus" id="pushStatus">상태를 확인하는 중입니다.</div>
          <div class="piActions">
            <button class="piBtn primary" id="pushSubscribeBtn" type="button">알림 받기</button>
            <button class="piBtn danger" id="pushUnsubscribeBtn" type="button">알림 끄기</button>
          </div>
        </div>

        <div id="pushInboxList"></div>

        <button id="pushAdminToggle" type="button">관리자 푸시 발송</button>

        <div id="pushAdminPanel">
          <div class="piSectionTitle">관리자 푸시 발송</div>
          <div class="piGrid">
            <div class="piField">
              <label for="pushTarget">발송 대상</label>
              <select id="pushTarget">
                <option value="all">전체 승인회원</option>
                <option value="resident">새정이마을주민</option>
                <option value="landowner">일반토지주</option>
                <option value="admin">관리자</option>
                <option value="user">특정 회원</option>
                <option value="self">내 기기 테스트</option>
              </select>
            </div>
            <div class="piField" id="pushMemberWrap" hidden>
              <label for="pushMember">특정 회원</label>
              <select id="pushMember"><option value="">회원 선택</option></select>
            </div>
            <div class="piField full">
              <label for="pushSendTitle">제목</label>
              <input id="pushSendTitle" maxlength="80" value="서울서리풀1 씹어먹기">
            </div>
            <div class="piField full">
              <label for="pushSendBody">내용</label>
              <textarea id="pushSendBody" maxlength="240" placeholder="보낼 내용을 입력하세요"></textarea>
            </div>
            <div class="piField full">
              <label for="pushSendUrl">누르면 열 페이지</label>
              <input id="pushSendUrl" maxlength="1000" value="./">
            </div>
          </div>
          <div class="piActions">
            <button class="piBtn primary" id="pushSendBtn" type="button">푸시 발송</button>
          </div>
          <div id="pushSendResult"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const el = id => document.getElementById(id);

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
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '요청을 처리할 수 없습니다.');
    return data;
  };

  const urlBase64ToUint8Array = base64String => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  };

  const ensureRegistration = async () => {
    if (!('serviceWorker' in navigator)) throw new Error('이 브라우저는 Service Worker를 지원하지 않습니다.');
    const reg = await navigator.serviceWorker.register(`./sw.js?v=${VERSION}`, { scope: './' });
    await navigator.serviceWorker.ready;
    return reg;
  };

  const getSubscription = async () => {
    const reg = await ensureRegistration();
    return reg.pushManager.getSubscription();
  };

  const updateBellBadge = count => {
    const badge = el('pushBellBadge');
    const n = Number(count || 0);
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.style.display = 'flex';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  };

  const fmtDate = iso => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
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

  const refreshPushState = async () => {
    const banner = el('pushBanner');
    const bannerText = el('pushBannerText');
    const bannerAction = el('pushBannerAction');
    const status = el('pushStatus');
    const onBtn = el('pushSubscribeBtn');
    const offBtn = el('pushUnsubscribeBtn');

    banner.classList.remove('show');
    bannerAction.textContent = '켜기';

    if (!window.isSecureContext) {
      status.textContent = 'HTTPS 보안 연결이 아니어서 푸시 알림을 사용할 수 없습니다.';
      onBtn.disabled = true;
      offBtn.disabled = true;
      return;
    }

    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
      status.textContent = '이 브라우저에서는 웹 푸시 알림을 사용할 수 없습니다.';
      onBtn.disabled = true;
      offBtn.disabled = true;
      return;
    }

    let sub = null;
    try { sub = await getSubscription(); } catch {}

    if (Notification.permission === 'granted' && sub) {
      status.textContent = '이 기기에서 푸시 알림을 받고 있습니다.';
      onBtn.disabled = true;
      offBtn.disabled = false;
      return;
    }

    if (Notification.permission === 'denied') {
      status.textContent = '브라우저에서 이 사이트의 알림이 차단되어 있습니다. 사이트 설정에서 알림을 허용해 주세요.';
      onBtn.disabled = true;
      offBtn.disabled = !sub;
      bannerText.textContent = '푸시 알림이 차단되어 있습니다.';
      bannerAction.textContent = '설정';
      banner.classList.add('show');
      return;
    }

    status.textContent = Notification.permission === 'granted'
      ? '알림 권한은 허용되어 있지만 이 기기의 푸시 구독이 꺼져 있습니다.'
      : '푸시 알림이 꺼져 있습니다.';

    onBtn.disabled = false;
    offBtn.disabled = !sub;
    bannerText.textContent = '푸시 알림이 꺼져 있습니다.';
    bannerAction.textContent = '켜기';
    banner.classList.add('show');
  };

  const subscribePush = async () => {
    const status = el('pushStatus');
    const btn = el('pushSubscribeBtn');
    btn.disabled = true;

    try {
      if (!window.isSecureContext) throw new Error('HTTPS 보안 연결이 필요합니다.');
      if (!('Notification' in window)) throw new Error('이 브라우저는 알림 기능을 지원하지 않습니다.');

      if (Notification.permission === 'denied') {
        throw new Error('브라우저 사이트 설정에서 알림을 먼저 허용해 주세요.');
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');
      }

      const c = pushConfig || await call({ action: 'config' });
      pushConfig = c;

      const reg = await ensureRegistration();
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

      status.textContent = '알림 수신 설정이 완료되었습니다.';
      await refreshPushState();
    } catch (e) {
      status.textContent = `알림 설정 실패: ${e.message || e}`;
      btn.disabled = false;
    }
  };

  const unsubscribePush = async () => {
    const status = el('pushStatus');
    try {
      const sub = await getSubscription();
      if (sub) {
        try {
          await call({ action: 'unsubscribe', endpoint: sub.endpoint });
        } finally {
          await sub.unsubscribe();
        }
      }
      status.textContent = '푸시 알림이 꺼졌습니다.';
      await refreshPushState();
    } catch (e) {
      status.textContent = `알림 해제 실패: ${e.message || e}`;
    }
  };

  const loadInbox = async () => {
    const list = el('pushInboxList');
    try {
      const data = await call({ action: 'inbox' });
      inboxItems = data.items || [];
      updateBellBadge(data.unread_count || 0);
      el('pushInboxCount').textContent = inboxItems.length ? `최근 ${inboxItems.length}건` : '';

      if (!inboxItems.length) {
        list.innerHTML = '<div class="piEmpty">아직 받은 알림이 없습니다.</div>';
        return;
      }

      list.innerHTML = inboxItems.map(item => `
        <div class="piItem ${item.read_at ? '' : 'unread'}" data-message-id="${esc(item.id)}" data-url="${esc(item.url || './')}">
          ${item.read_at ? '' : '<span class="piUnreadDot"></span>'}
          <div class="piItemTitle">${esc(item.title)}</div>
          <div class="piItemBody">${esc(item.body)}</div>
          <div class="piItemTime">${esc(fmtDate(item.sent_at))}</div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<div class="piEmpty">${esc(e.message || '알림을 불러오지 못했습니다.')}</div>`;
    }
  };

  const markReadAndOpen = async itemEl => {
    const id = itemEl.dataset.messageId;
    const url = itemEl.dataset.url || './';

    if (itemEl.classList.contains('unread')) {
      try {
        await call({ action: 'mark_read', message_id: id });
        itemEl.classList.remove('unread');
        itemEl.querySelector('.piUnreadDot')?.remove();
        const current = Number(el('pushBellBadge').textContent || 0);
        if (Number.isFinite(current) && current > 0) updateBellBadge(current - 1);
      } catch {}
    }

    if (url && url !== './') {
      window.location.href = url;
    }
  };

  const markAllRead = async () => {
    try {
      await call({ action: 'mark_all_read' });
      updateBellBadge(0);
      await loadInbox();
    } catch {}
  };

  const roleLabel = role => ({
    resident: '새정이마을주민',
    landowner: '일반토지주',
    admin: '관리자'
  }[role] || role || '');

  const loadMembers = async () => {
    if (membersLoaded) return;
    const data = await call({ action: 'admin_members' });
    const member = el('pushMember');
    member.innerHTML = '<option value="">회원 선택</option>' +
      (data.members || []).map(m =>
        `<option value="${esc(m.user_id)}">${esc(m.full_name || '회원')} · ${esc(roleLabel(m.membership_role))} · 알림기기 ${Number(m.push_count || 0)}</option>`
      ).join('');
    membersLoaded = true;
  };

  const sendPush = async () => {
    const btn = el('pushSendBtn');
    const result = el('pushSendResult');
    btn.disabled = true;
    result.className = 'show';
    result.textContent = '발송 중입니다.';

    try {
      const data = await call({
        action: 'send',
        target: el('pushTarget').value,
        target_user_id: el('pushMember').value,
        title: el('pushSendTitle').value.trim(),
        body: el('pushSendBody').value.trim(),
        url: el('pushSendUrl').value.trim() || './'
      });

      result.className = 'ok';
      result.textContent =
        `알림함 ${Number(data.recipient_count || 0)}명 저장 · 푸시 대상기기 ${Number(data.subscription_count || 0)}대 · 성공 ${Number(data.success_count || 0)}대 · 실패 ${Number(data.failure_count || 0)}대`;

      await loadInbox();
    } catch (e) {
      result.className = 'err';
      result.textContent = e.message || '발송에 실패했습니다.';
    } finally {
      btn.disabled = false;
    }
  };

  const syncLogin = async () => {
    try {
      const token = await getToken();
      if (!token) {
        bell.style.display = 'none';
        updateBellBadge(0);
        pushConfig = null;
        return;
      }

      const data = await call({ action: 'config' });
      pushConfig = data;
      bell.style.display = 'flex';
      el('pushAdminToggle').style.display = data.is_admin ? 'block' : 'none';
      if (!data.is_admin) el('pushAdminPanel').classList.remove('open');
      updateBellBadge(data.unread_count || 0);

      if (isInboxOpen) {
        await Promise.all([loadInbox(), refreshPushState()]);
      }
    } catch {
      bell.style.display = 'none';
      updateBellBadge(0);
      pushConfig = null;
    }
  };

  const openInbox = async () => {
    const token = await getToken();
    if (!token) return;

    isInboxOpen = true;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    try {
      pushConfig = await call({ action: 'config' });
      el('pushAdminToggle').style.display = pushConfig.is_admin ? 'block' : 'none';
      await Promise.all([loadInbox(), refreshPushState()]);
    } catch (e) {
      el('pushInboxList').innerHTML = `<div class="piEmpty">${esc(e.message || '알림함을 열 수 없습니다.')}</div>`;
    }
  };

  const closeInbox = () => {
    isInboxOpen = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    el('pushSettings').classList.remove('open');
    el('pushAdminPanel').classList.remove('open');
  };

  bell.addEventListener('click', openInbox);
  el('pushCloseBtn').addEventListener('click', closeInbox);
  modal.addEventListener('click', e => { if (e.target === modal) closeInbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isInboxOpen) closeInbox(); });

  el('pushSettingsBtn').addEventListener('click', async () => {
    el('pushSettings').classList.toggle('open');
    if (el('pushSettings').classList.contains('open')) await refreshPushState();
  });

  el('pushBannerAction').addEventListener('click', async () => {
    if (Notification.permission === 'denied') {
      el('pushSettings').classList.add('open');
      el('pushStatus').textContent = '브라우저 사이트 설정에서 이 사이트의 알림을 허용한 뒤 다시 시도해 주세요.';
      return;
    }
    await subscribePush();
  });

  el('pushSubscribeBtn').addEventListener('click', subscribePush);
  el('pushUnsubscribeBtn').addEventListener('click', unsubscribePush);
  el('pushMarkAll').addEventListener('click', markAllRead);

  el('pushInboxList').addEventListener('click', e => {
    const item = e.target.closest('.piItem');
    if (item) markReadAndOpen(item);
  });

  el('pushAdminToggle').addEventListener('click', () => {
    el('pushAdminPanel').classList.toggle('open');
  });

  el('pushTarget').addEventListener('change', async () => {
    const isUser = el('pushTarget').value === 'user';
    el('pushMemberWrap').hidden = !isUser;
    if (isUser) {
      try { await loadMembers(); } catch {}
    }
  });

  el('pushSendBtn').addEventListener('click', sendPush);

  sb.auth.onAuthStateChange(() => setTimeout(syncLogin, 100));
  window.addEventListener('pageshow', syncLogin);
  window.addEventListener('focus', syncLogin);

  setTimeout(syncLogin, 300);
  setInterval(syncLogin, 60000);
})();
