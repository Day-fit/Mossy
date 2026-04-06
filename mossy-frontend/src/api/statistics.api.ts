import { apiFetch } from './client.ts';

export type DashboardStatisticsResponse = {
	passwordChart: {
		date: string;
		addedCount: number;
	}[];
	recentActions: {
		date: string;
		actionType: 'added' | 'removed' | 'updated';
		domain: string;
	}[];
};

export async function executeDashboardStatisticsRequest(): Promise<DashboardStatisticsResponse> {
	const response = await apiFetch('/api/v1/statistics/dashboard', {
		method: 'GET',
	});

	return response.json();
}
