import { afterEach, describe, expect, it, vi } from 'vitest';

describe('notification-service IP geolocation fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('falls back to ipapi.co when ipwho.is fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        country_name: 'China',
        city: 'Shanghai',
        org: 'Example ISP',
        asn: 'AS64500'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendEnhancedTgNotification } = await import('../../functions/services/notification-service.js');
    const sent = await sendEnhancedTgNotification(
      { BotToken: 'bot-token', ChatID: 'chat-id' },
      '<b>订阅被访问</b>',
      '1.2.3.4',
      '<b>节点数:</b> <code>2</code>'
    );

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://ipwho.is/1.2.3.4', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://ipapi.co/1.2.3.4/json/', expect.any(Object));
    const telegramPayload = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(telegramPayload.text).toContain('China');
    expect(telegramPayload.text).toContain('Shanghai');
    expect(telegramPayload.text).toContain('Example ISP');
    expect(telegramPayload.text).toContain('AS64500');
  });
});
