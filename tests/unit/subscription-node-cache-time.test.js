import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Card from '../../src/components/ui/Card.vue';
import { createI18n } from '../../src/i18n/index.js';
import { useDataStore } from '../../src/stores/useDataStore.js';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
}));

vi.mock('../../src/lib/http.js', () => ({
    api: {
        get: (...args) => mockApiGet(...args),
        post: (...args) => mockApiPost(...args),
    },
}));

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({
        showToast: vi.fn(),
    }),
}));

function mountCard(misub, locale = 'zh-CN') {
    return mount(Card, {
        props: { misub },
        global: {
            plugins: [createI18n({ initialLocale: locale })],
            stubs: {
                Switch: { template: '<button class="switch-stub"></button>' },
            },
        },
    });
}

function formatExpectedLocal(iso, alwaysIncludeYear = false) {
    const date = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    if (alwaysIncludeYear || year !== new Date().getFullYear()) {
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    return `${month}-${day} ${hours}:${minutes}:${seconds}`;
}

describe('subscription protective node cache timestamp display', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mockApiGet.mockReset();
        mockApiPost.mockReset();
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
    });

    it('hides cache time row when protective node cache is disabled', () => {
        const wrapper = mountCard({
            id: 'sub_off',
            name: '未开启缓存',
            url: 'https://example.com/sub',
            enabled: true,
            nodeCount: 12,
            enableNodeCache: false,
            nodeCacheUpdatedAt: '2026-11-24T06:20:05.000Z',
        });

        expect(wrapper.find('[data-testid="subscription-node-cache-time"]').exists()).toBe(false);
    });

    it('renders formatted cache time with seconds (MM-DD HH:mm:ss for current year, YYYY-MM-DD HH:mm:ss across years)', () => {
        const currentYear = new Date().getFullYear();
        const sameYearIso = new Date(currentYear, 10, 24, 14, 20, 5).toISOString();
        const sameYearWrapper = mountCard({
            id: 'sub_on',
            name: '已开启缓存',
            url: 'https://example.com/sub',
            enabled: true,
            nodeCount: 84,
            enableNodeCache: true,
            nodeCacheUpdatedAt: sameYearIso,
            nodeCacheCount: 84,
        });

        const sameYearRow = sameYearWrapper.get('[data-testid="subscription-node-cache-time"]');
        expect(sameYearRow.text()).toContain('缓存时间');
        expect(sameYearRow.text()).toContain(formatExpectedLocal(sameYearIso, false));
        expect(sameYearRow.text()).not.toContain(`${currentYear}-`);
        expect(sameYearRow.attributes('title')).toContain(formatExpectedLocal(sameYearIso, true));
        expect(sameYearRow.attributes('title')).toContain('84');

        const prevYearIso = new Date(currentYear - 1, 11, 31, 23, 59, 59).toISOString();
        const prevYearWrapper = mountCard({
            id: 'sub_prev_year',
            name: '跨年缓存',
            url: 'https://example.com/sub',
            enabled: true,
            nodeCount: 12,
            enableNodeCache: true,
            nodeCacheUpdatedAt: prevYearIso,
            nodeCacheCount: 12,
        });

        const prevYearRow = prevYearWrapper.get('[data-testid="subscription-node-cache-time"]');
        expect(prevYearRow.text()).toContain(formatExpectedLocal(prevYearIso, false));
        expect(prevYearRow.text()).toContain(`${currentYear - 1}-`);
    });

    it('renders empty cache fallback when enabled without cache data or with invalid date', () => {
        const zhWrapper = mountCard(
            {
                id: 'sub_empty',
                name: '暂无缓存订阅',
                url: 'https://example.com/sub',
                enabled: true,
                nodeCount: 10,
                enableNodeCache: true,
                nodeCacheUpdatedAt: null,
            },
            'zh-CN'
        );

        const zhRow = zhWrapper.get('[data-testid="subscription-node-cache-time"]');
        expect(zhRow.text()).toContain('缓存时间');
        expect(zhRow.text()).toContain('暂无缓存');
        expect(zhRow.attributes('title')).toContain('待订阅成功拉取后生成缓存');

        const enWrapper = mountCard(
            {
                id: 'sub_invalid',
                name: 'Invalid Timestamp Sub',
                url: 'https://example.com/sub',
                enabled: true,
                nodeCount: 10,
                enableNodeCache: true,
                nodeCacheUpdatedAt: 'not-a-valid-date',
            },
            'en-US'
        );

        const enRow = enWrapper.get('[data-testid="subscription-node-cache-time"]');
        expect(enRow.text()).toContain('Cache time');
        expect(enRow.text()).toContain('No cache yet');
    });

    it('strips transient node cache metadata before saving to /api/misubs and keeps backend response metadata', async () => {
        const cachedAt = '2026-11-24T06:20:05.000Z';
        const dataStore = useDataStore();
        dataStore.hydrateFromData({
            misubs: [
                {
                    id: 'sub_1',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: true,
                    nodeCacheUpdatedAt: cachedAt,
                    nodeCacheCount: 18,
                },
            ],
            profiles: [],
            ruleTemplates: [],
            config: {},
        });

        mockApiPost.mockResolvedValue({
            success: true,
            data: {
                misubs: [
                    {
                        id: 'sub_1',
                        name: '机场A',
                        url: 'https://example.com/sub',
                        enabled: true,
                        enableNodeCache: true,
                        nodeCacheUpdatedAt: cachedAt,
                        nodeCacheCount: 18,
                    },
                ],
                profiles: [],
            },
        });

        const saved = await dataStore.saveData();
        expect(saved).toBe(true);
        expect(mockApiPost).toHaveBeenCalledWith(
            '/api/misubs',
            expect.objectContaining({
                misubs: [
                    {
                        id: 'sub_1',
                        name: '机场A',
                        url: 'https://example.com/sub',
                        enabled: true,
                        enableNodeCache: true,
                    },
                ],
            })
        );
        expect(dataStore.subscriptions[0].nodeCacheUpdatedAt).toBe(cachedAt);
        expect(dataStore.subscriptions[0].nodeCacheCount).toBe(18);
    });
});
