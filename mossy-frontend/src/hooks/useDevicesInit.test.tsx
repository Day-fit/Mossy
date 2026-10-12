import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { useDeviceManagementStore } from '../store/deviceManagementStore.ts';
import { useDevicesInit } from './useDevicesInit.ts';
const api = vi.hoisted(() => ({
    executeGetDevicesRequest: vi.fn(),
    executeGetEnrollmentsRequest: vi.fn(),
    receiveEnrollmentEvents: vi.fn(),
}));
vi.mock('../api/deviceTrust.api.ts', () => api);
const enrollment = {
    id: 'enrollment-1',
    lastOsName: 'Linux',
    deviceType: 'Desktop',
    remoteAddr: '192.0.2.1',
    createdAt: '2026-10-11T12:00:00Z',
};
beforeEach(() => {
    vi.resetAllMocks();
    useDeviceManagementStore.getState().clear();
    useAuthStore.getState().setIsAuthenticated(true);
    api.executeGetDevicesRequest.mockResolvedValue([]);
    api.executeGetEnrollmentsRequest.mockResolvedValue([]);
    api.receiveEnrollmentEvents.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
describe('device enrollment subscription', () => {
    it('updates shared state without duplicates and aborts on logout', async () => {
        renderHook(useDevicesInit);
        await waitFor(() =>
            expect(api.receiveEnrollmentEvents).toHaveBeenCalledOnce()
        );
        const [signal, onEnrollment] =
            api.receiveEnrollmentEvents.mock.calls[0];
        act(() => {
            onEnrollment(enrollment);
            onEnrollment(enrollment);
        });
        expect(useDeviceManagementStore.getState().enrollments).toEqual([
            enrollment,
        ]);
        act(() => useAuthStore.getState().setIsAuthenticated(false));
        expect(signal.aborted).toBe(true);
        act(() => onEnrollment(enrollment));
        expect(useDeviceManagementStore.getState().enrollments).toEqual([]);
    });
    it('reconnects after EOF and resyncs when the connection opens', async () => {
        vi.useFakeTimers();
        api.receiveEnrollmentEvents.mockImplementationOnce(
            async (_signal, _onEnrollment, onOpen) => onOpen()
        );
        const { unmount } = renderHook(useDevicesInit);
        await act(async () => {});
        expect(api.receiveEnrollmentEvents).toHaveBeenCalledOnce();
        expect(api.executeGetEnrollmentsRequest).toHaveBeenCalledTimes(2);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000);
        });
        expect(api.receiveEnrollmentEvents).toHaveBeenCalledTimes(2);
        unmount();
        expect(api.receiveEnrollmentEvents.mock.calls[1][0].aborted).toBe(true);
    });
    it('preserves events during snapshot loading and ignores results after logout', async () => {
        let resolveSnapshot!: (value: (typeof enrollment)[]) => void;
        api.executeGetEnrollmentsRequest.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveSnapshot = resolve;
                })
        );
        renderHook(useDevicesInit);
        act(() =>
            useDeviceManagementStore.getState().upsertEnrollment(enrollment)
        );
        await act(async () => resolveSnapshot([]));
        expect(useDeviceManagementStore.getState().enrollments).toEqual([
            enrollment,
        ]);
        api.executeGetEnrollmentsRequest.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveSnapshot = resolve;
                })
        );
        act(() => api.receiveEnrollmentEvents.mock.calls[0][2]());
        act(() => useAuthStore.getState().setIsAuthenticated(false));
        await act(async () => resolveSnapshot([enrollment]));
        expect(useDeviceManagementStore.getState().enrollments).toEqual([]);
    });
});
