import { apiFetch } from './client.ts';
import type { ActionType } from '../ui/dashboard';

export type DashboardStatisticsResponse = {
	totalPasswords: number;
	passwordChart: {
		date: string;
		passwordCount: number;
		addedCount: number;
	}[];
	recentActions: {
		date: string;
		actionType: ActionType;
		domain: string;
	}[];
};

export async function executeDashboardStatisticsRequest(): Promise<DashboardStatisticsResponse> {
	const response = await apiFetch('/api/v1/statistics/dashboard', {
		method: 'GET',
	});

	const data =
		(await response.json()) as Partial<DashboardStatisticsResponse>;

	return {
		totalPasswords:
			typeof data?.totalPasswords === 'number' ? data.totalPasswords : 0,
		passwordChart: Array.isArray(data?.passwordChart)
			? data.passwordChart
			: [],
		recentActions: Array.isArray(data?.recentActions)
			? data.recentActions
			: [],
	};
}
