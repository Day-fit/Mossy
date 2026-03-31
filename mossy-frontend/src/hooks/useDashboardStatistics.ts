import { useCallback, useEffect, useState } from 'react';
import {
	executeDashboardStatisticsRequest,
	type DashboardStatisticsResponse,
} from '../api/statistics.api.ts';

const EMPTY_STATISTICS: DashboardStatisticsResponse = {
	passwordChart: [],
	recentActions: [],
	vaults: [],
};

type UseDashboardStatisticsResult = {
	statistics: DashboardStatisticsResponse;
	isLoading: boolean;
	error: string | null;
	reload: () => Promise<void>;
};

export function useDashboardStatistics(
	refreshIntervalMs: number = 0
): UseDashboardStatisticsResult {
	const [statistics, setStatistics] =
		useState<DashboardStatisticsResponse>(EMPTY_STATISTICS);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const loadStatistics = useCallback(async () => {
		try {
			const nextStatistics = await executeDashboardStatisticsRequest();
			nextStatistics.recentActions.map((entry) => {
				new Date(entry.date);
			});
			setStatistics(nextStatistics);
			setError(null);
		} catch {
			setStatistics(EMPTY_STATISTICS);
			setError('Failed to load dashboard statistics');
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		setIsLoading(true);
		void loadStatistics();

		if (refreshIntervalMs <= 0) {
			return;
		}

		const interval = setInterval(() => {
			void loadStatistics();
		}, refreshIntervalMs);

		return () => clearInterval(interval);
	}, [loadStatistics, refreshIntervalMs]);

	return {
		statistics,
		isLoading,
		error,
		reload: loadStatistics,
	};
}
