import 'fake-indexeddb/auto';
import { observable } from '../src/observable';
import { Change } from '../src/observableInterfaces';
import { ObservablePersistLocalStorage } from '../src/persist-plugins/local-storage';
import { persistObservable, transformOutData } from '../src/persist/persistObservable';
import { when } from '../src/when';
import { mockLocalStorage } from './testglobals';

function promiseTimeout(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time || 0));
}
// @ts-expect-error This is ok to do in jest
globalThis._testlocalStorage = mockLocalStorage();

describe('Creating', () => {
    test('Loading state works correctly', async () => {
        const nodes = observable<Record<string, { key: string }>>({});
        let lastSet;
        const state = persistObservable(nodes, {
            pluginLocal: ObservablePersistLocalStorage,
            local: 'nodes',
            pluginRemote: {
                get: async () => {
                    const nodes = await new Promise<{ key: string }[]>((resolve) =>
                        setTimeout(() => resolve([{ key: 'key0' }]), 10),
                    );
                    return nodes.reduce(
                        (acc, node) => {
                            acc[node.key] = node;
                            return acc;
                        },
                        {} as Record<string, { key: string }>,
                    );
                },
                set: async ({ value }: { value: any; changes: Change[] }) => {
                    lastSet = value;
                },
            },
        });

        await when(state.isLoadedLocal);
        await when(state.isLoaded);
        expect(lastSet).toEqual(undefined);
        expect(nodes.get()).toEqual({ key0: { key: 'key0' } });
    });
});

describe('Adjusting data', () => {
    test('transformOutData with transform', () => {
        const adjusted = transformOutData({ id: 'id', text: 'a' }, [], [], {
            transform: {
                save: (value) => {
                    value.text = 'b';
                    return value;
                },
            },
        });

        expect(adjusted).toEqual({ path: [], value: { id: 'id', text: 'b' } });
    });
    test('transformOutData with transform and fieldTransforms', () => {
        const adjusted = transformOutData({ id: 'id', text: 'a' }, [], [], {
            transform: {
                save: (value) => {
                    value.text = 'b';
                    return value;
                },
            },
            fieldTransforms: {
                id: 'id',
                text: 't',
            },
        });

        expect(adjusted).toEqual({ path: [], value: { id: 'id', t: 'b' } });
    });
    test('transformOutData with transform and fieldTransforms and path', () => {
        const adjusted = transformOutData({ id: 'id', text: 'a' }, ['path'], ['object'], {
            transform: {
                save: (value) => {
                    value.path.text = 'b';
                    return value;
                },
            },
            fieldTransforms: {
                _dict: {
                    id: 'id',
                    text: 't',
                },
            },
        });

        expect(adjusted).toEqual({ path: ['path'], value: { id: 'id', t: 'b' } });
    });
    test('transformOutData with transform promise and fieldTransforms and path', async () => {
        const adjusted = await transformOutData({ id: 'id', text: 'a' }, ['path'], ['object'], {
            transform: {
                save: async (value) => {
                    value.path.text = 'b';
                    await promiseTimeout(10);
                    return value;
                },
            },
            fieldTransforms: {
                _dict: {
                    id: 'id',
                    text: 't',
                },
            },
        });

        expect(adjusted).toEqual({ path: ['path'], value: { id: 'id', t: 'b' } });
    });
});
