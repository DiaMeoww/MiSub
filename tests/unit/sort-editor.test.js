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
});
