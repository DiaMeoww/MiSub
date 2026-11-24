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

function formatExpectedLocal(iso) {
    const date = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

    it('renders formatted cache time and tooltip with cached node count when enabled', () => {
        const iso = new Date(new Date().getFullYear(), 10, 24, 14, 20, 5).toISOString();
        const wrapper = mountCard({
            id: 'sub_on',
            name: '已开启缓存',
            url: 'https://example.com/sub',
            enabled: true,
            nodeCount: 84,
            enableNodeCache: true,
            nodeCacheUpdatedAt: iso,
            nodeCacheCount: 84,
        });

        const row = wrapper.get('[data-testid="subscription-node-cache-time"]');
        expect(row.text()).toContain('缓存时间');
        expect(row.text()).toContain(formatExpectedLocal(iso));
        expect(row.attributes('title')).toContain(formatExpectedLocal(iso));
        expect(row.attributes('title')).toContain('84');
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
