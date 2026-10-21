import { messaging } from '../messaging/rpc';

messaging.onMessage('handleLogin', async ({ data }) => {
    const result = await signIn(instance, command);
    command.password = '';
    await lastIdentifierSetting.setValue(command.identifier);
    deviceId = result.deviceId;
    if (result.status === 'authenticated') {
        tokenStorage.set(result.accessToken);
    }
    return { status: result.status };
});

messaging.onMessage('handleLogout', async ({ sender }) => {
    await executeExtensionLogoutRequest(retiring);
    return { status: 'ok' as const };
});

function requirePopup(sender: chrome.runtime.MessageSender) {
    if (!trustedPage(sender, '/popup.html'))
        throw new Error('Untrusted source.');
}
