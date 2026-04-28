import { apiFetch } from './client.ts';
import type { ActionType } from '../ui/dashboard';

export type DashboardStatisticsResponse = {
	passwordChart: {
		date: string;
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

	const data = (await response.json()) as Partial<DashboardStatisticsResponse>;

	const normalized: DashboardStatisticsResponse = {
		passwordChart: Array.isArray(data?.passwordChart)
			? data.passwordChart
			: [],
		recentActions: Array.isArray(data?.recentActions)
			? data.recentActions
			: [],
	};

	return normalized;
}
