import { instanceSetting } from '../storage/settings';

let instance: Promise<string> | undefined;

export function getInstance(): Promise<string> {
    return (instance ??= instanceSetting.getValue());
}

export async function setInstance(value: string): Promise<void> {
    await instanceSetting.setValue(value);
    instance = Promise.resolve(value);
}

instanceSetting.watch((value) => {
    instance = Promise.resolve(value);
});
