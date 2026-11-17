import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SortEditor from '../../src/components/features/Operators/components/SortEditor.vue';
import { createI18n } from '../../src/i18n/index.js';

const mountSortEditor = (modelValue = { keys: [] }, locale = 'zh-CN') =>
    mount(SortEditor, {
        props: { modelValue },
        global: {
            plugins: [createI18n({ initialLocale: locale })],
            stubs: {
                draggable: {
                    props: ['modelValue'],
                    template:
                        '<div><div v-for="(element, index) in modelValue" :key="element.id"><slot name="item" :element="element" :index="index" /></div></div>',
                },
            },
        },
    });

describe('SortEditor', () => {
    it('renders sort key options in the expected order', () => {
        const wrapper = mountSortEditor({
            keys: [{ key: 'region', order: 'asc', customOrder: ['香港'] }],
        });

        const keySelect = wrapper.findAll('select')[0];
        const options = keySelect.findAll('option').map((option) => ({
            value: option.element.value,
            text: option.text().trim(),
        }));

        expect(options).toEqual([
            { value: 'region', text: '地区' },
            { value: 'protocol', text: '协议' },
            { value: 'name', text: '节点名称' },
            { value: 'regex', text: '正则置顶' },
            { value: 'group', text: '自定义分组' },
            { value: 'server', text: '服务器' },
            { value: 'port', text: '端口' },
        ]);
    });

    it('defaults newly added sort condition to region with default region priority order', async () => {
        const wrapper = mountSortEditor({ keys: [] });

        const addButton = wrapper.findAll('button').find((btn) => btn.text().includes('添加条件'));
        expect(addButton).toBeTruthy();

        await addButton.trigger('click');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0].keys).toEqual([
            {
                key: 'region',
                order: 'asc',
                customOrder: [
                    '香港',
                    '台湾',
                    '日本',
                    '新加坡',
                    '美国',
                    '韩国',
                    '英国',
                    '德国',
                    '法国',
                    '加拿大',
                ],
            },
        ]);
    });

    it('renders regex pin editor in English without leaking Chinese or keys', async () => {
        const wrapper = mountSortEditor(
            { keys: [{ key: 'regex', order: 'asc', customOrder: [] }] },
            'en-US'
        );

        expect(wrapper.text()).not.toMatch(/[\u4e00-\u9fff]/);
        expect(wrapper.text()).not.toMatch(/\boperators\./);

        const input = wrapper.find('input[type="text"]');
        await input.setValue('dmit');
        await input.trigger('keydown.enter');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0].keys[0].customOrder).toEqual(['dmit']);
    });

    it('ignores Enter during IME composition and validates invalid regex syntax', async () => {
        const wrapper = mountSortEditor({
            keys: [{ key: 'regex', order: 'asc', customOrder: [] }],
        });

        const input = wrapper.find('input[type="text"]');
        await input.setValue('yamaxun');
        await input.trigger('keydown.enter', { isComposing: true });
        expect(wrapper.emitted('update:modelValue')).toBeFalsy();

        await input.setValue('[HK');
        await input.trigger('keydown.enter', { isComposing: false });
        expect(wrapper.emitted('update:modelValue')).toBeFalsy();
        expect(wrapper.text()).toContain('正则表达式语法有误');

        await input.setValue('亚马逊');
        expect(wrapper.text()).not.toContain('正则表达式语法有误');

        await input.trigger('keydown.enter', { isComposing: false });
        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0].keys[0].customOrder).toEqual(['亚马逊']);
    });

    it('keeps unsubmitted regex drafts aligned when reordering sort conditions', async () => {
        const model = {
            keys: [
                { key: 'region', order: 'asc', customOrder: ['香港'] },
                { key: 'regex', order: 'asc', customOrder: [] },
            ],
        };
        const wrapper = mount(SortEditor, {
            props: {
                modelValue: model,
                'onUpdate:modelValue': (val) => wrapper.setProps({ modelValue: val }),
            },
            global: {
                plugins: [createI18n({ initialLocale: 'zh-CN' })],
                stubs: {
                    draggable: {
                        props: ['modelValue'],
                        template:
                            '<div><div v-for="(element, index) in modelValue" :key="element.id"><slot name="item" :element="element" :index="index" /></div></div>',
                    },
                },
            },
        });

        const inputBefore = wrapper.find('input[type="text"]');
        await inputBefore.setValue('dmit');

        const moveUpButtons = wrapper.findAll('button[aria-label="上移"]');
        await moveUpButtons[1].trigger('click');

        const inputAfter = wrapper.find('input[type="text"]');
        expect(inputAfter.element.value).toBe('dmit');
    });
});
