import React, { JSX } from 'react';
import { LinearClient, Initiative, Project, ProjectStatus } from "@linear/sdk";
import AutoRefresher from '@/components/AutoRefresher'; 

interface ProjectWithStatus {
  project: Project;
  status: ProjectStatus | null;
}

interface InitiativeWithProjects {
  initiative: Initiative;
  projects: ProjectWithStatus[];
  completionPercentage: number;
  completedProjectCount: number;
  totalProjectCount: number;
  targetDate?: string;
  isCompleted: boolean;
}

interface CycleInfo {
  name: string;
  progress: number;
  isActive: boolean;
}

interface HomePageProps {
  activeInitiatives: InitiativeWithProjects[];
  cycles: CycleInfo[];
  error?: string;
}

async function getCycles(): Promise<CycleInfo[]> {
  if (!process.env.LINEAR_API_KEY) {
    console.error("Linear API key is not configured.");
    throw new Error("Linear API key is not configured. Please set LINEAR_API_KEY in your .env.local file.");
  }

  const client = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY,
  });

  try {
    const cyclesConnection = await client.cycles({
      first: 50,
    });

    const cycles = cyclesConnection.nodes.map(cycle => ({
      name: cycle.name || 'Unnamed Cycle',
      progress: cycle.progress,
      isActive: cycle.isActive ?? false,
    }));

    return cycles;
  } catch (error) {
    console.error("Error in getCycles:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch cycles from Linear: ${error.message}`);
    } else {
      throw new Error("An unknown error occurred while fetching cycles.");
    }
  }
}

async function getActiveAndRecentInitiatives(): Promise<InitiativeWithProjects[]> {
  if (!process.env.LINEAR_API_KEY) {
    console.error("Linear API key is not configured.");
    throw new Error("Linear API key is not configured. Please set LINEAR_API_KEY in your .env.local file.");
  }

  const client = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY,
  });

  const filterOutKeywords = ["data assets", "core business", "maintenance", "cycle reporting repo"];

  try {
    const completionStatuses = new Set(['Completed', 'Canceled', 'Postponed']);
    const processedInitiatives: InitiativeWithProjects[] = [];
    let hasNextPage = true;
    let afterCursor: string | undefined = undefined;

    console.log("Fetching active and recently completed initiatives with projects and statuses...");

    while (hasNextPage) {
      const initiativesConnection = await client.initiatives({
        first: 25, 
        after: afterCursor,
      });

      console.log(`Fetched page of initiatives. Has next: ${initiativesConnection.pageInfo.hasNextPage}. Nodes: ${initiativesConnection.nodes.length}`);

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const relevantInitiatives = initiativesConnection.nodes.filter(
        (initiative) => {
          // Include active initiatives
          if (initiative.status === 'Active') {
            const initiativeNameLower = initiative.name.toLowerCase();
            const shouldFilterOut = filterOutKeywords.some(keyword => 
              initiativeNameLower.includes(keyword.toLowerCase())
            );
            if (shouldFilterOut) {
              console.log(`Filtering out initiative: "${initiative.name}" due to keyword match.`);
              return false;
            }
            return true;
          }
          
          // Include completed initiatives from the last 3 months
          if (initiative.status === 'Completed' && initiative.completedAt) {
            const completedDate = new Date(initiative.completedAt);
            const isRecentlyCompleted = completedDate >= threeMonthsAgo;
            
            if (isRecentlyCompleted) {
              const initiativeNameLower = initiative.name.toLowerCase();
              const shouldFilterOut = filterOutKeywords.some(keyword => 
                initiativeNameLower.includes(keyword.toLowerCase())
              );
              if (shouldFilterOut) {
                console.log(`Filtering out completed initiative: "${initiative.name}" due to keyword match.`);
                return false;
              }
              return true;
            }
          }
          
          return false;
        }
      );

      for (const initiative of relevantInitiatives) { 
        let projectsWithStatus: ProjectWithStatus[] = [];
        let completedProjectCount = 0;
        let totalProjectCount = 0;

        try {
          const projectConnection = await initiative.projects({ first: 100 });
          const projects = projectConnection.nodes ?? [];
          totalProjectCount = projects.length;

          // Fetch all project statuses in parallel to reduce API calls
          const statusPromises = projects.map(async (project) => {
            try {
              const status = await project.status;
              return { project, status: status ?? null };
            } catch (statusError) {
              console.error(`Error fetching status for project ${project.id} (${project.name}):`, statusError);
              return { project, status: null };
            }
          });

          projectsWithStatus = await Promise.all(statusPromises);

          completedProjectCount = projectsWithStatus.filter(
            ({ status }) => status && completionStatuses.has(status.name)
          ).length;
        } catch (projectError) {
          console.error(`Error processing projects for initiative ${initiative.id} (${initiative.name}):`, projectError);
          projectsWithStatus = [];
          totalProjectCount = 0;
          completedProjectCount = 0;
        }

        const completionPercentage = totalProjectCount > 0 ? (completedProjectCount / totalProjectCount) * 100 : 0;

        processedInitiatives.push({
          initiative,
          projects: projectsWithStatus,
          completionPercentage,
          completedProjectCount,
          totalProjectCount,
          targetDate: initiative.targetDate,
          isCompleted: initiative.status === 'Completed'
        });
      }

      hasNextPage = initiativesConnection.pageInfo.hasNextPage;
      afterCursor = initiativesConnection.pageInfo.endCursor;
      if (hasNextPage) {
         console.log("Fetching next page of initiatives...");
      }
    } 

    processedInitiatives.sort((a, b) => {
      const dateA = new Date(a.initiative.updatedAt).getTime();
      const dateB = new Date(b.initiative.updatedAt).getTime();
      return dateB - dateA;
    });

    console.log(`Finished fetching. Processed ${processedInitiatives.length} active and recently completed initiatives.`);
    return processedInitiatives;

  } catch (error) {
    console.error("Error in getActiveInitiatives:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch initiatives from Linear: ${error.message}`);
    } else {
      throw new Error("An unknown error occurred while fetching initiatives.");
    }
  }
}

const formatTargetDate = (targetDate?: unknown): string => {
  if (!targetDate) return '';

  // Handle TimelessDate object
  if (typeof targetDate === 'object' && targetDate !== null && 'year' in targetDate && 'month' in targetDate && 'day' in targetDate) {
    const td = targetDate as { year: number; month: number; day: number };
    const date = new Date(td.year, td.month - 1, td.day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Handle string dates
  if (typeof targetDate === 'string') {
    const date = new Date(targetDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return '';
};

const FuelGauge: React.FC<{ percentage: number }> = ({ percentage }) => {
  const filledBars = Math.round((percentage / 100) * 10);
  const barColor = percentage < 70 ? 'bg-[var(--status-amber)]' : 'bg-[var(--status-green)]';

  return (
    <div className="flex items-center gap-1">
      {[...Array(10)].map((_, index) => (
        <div
          key={index}
          className={`w-3 h-8 lg:w-4 lg:h-10 rounded-sm ${
            index < filledBars
              ? barColor
              : 'bg-[var(--theme-border)]'
          }`}
        />
      ))}
    </div>
  );
};

const renderInitiativeTitle = (name: string): JSX.Element => {
  const prefixes = ['[Delivery]', '[Growth]', '[Foundation]'];
  
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return <>{name.substring(prefix.length).trim()}</>;
    }
  }
  return <>{name}</>; 
};

const HomePage: React.FC<HomePageProps> = ({ activeInitiatives, cycles, error }) => {
  // Calculate overall stats
  const totalProjects = activeInitiatives.reduce((sum, item) => sum + item.totalProjectCount, 0);
  const completedProjects = activeInitiatives.reduce((sum, item) => sum + item.completedProjectCount, 0);
  const activeCycles = cycles.filter(cycle => cycle.isActive);
  const avgCycleProgress = activeCycles.length > 0
    ? Math.round((activeCycles.reduce((sum, cycle) => sum + cycle.progress, 0) / activeCycles.length) * 100)
    : 0;

  const getPieChartColor = (health: string | undefined) => {
    if (health === 'onTrack') return 'var(--status-green)';
    if (health === 'atRisk') return 'var(--status-amber)';
    if (health === 'offTrack') return 'var(--status-red)';
    return 'var(--theme-text-secondary)'; // Fallback color
  };

  const PieChart: React.FC<{ percentage: number; health: string | undefined; size?: number }> = ({ percentage, health, size = 24 }) => {
    const radius = size / 2 - 3;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <div className="flex-shrink-0 progress-glow">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--theme-border)"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getPieChartColor(health)}
            strokeWidth="4"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-[var(--theme-bg)] text-[var(--theme-text-primary)]">
      <AutoRefresher />
      <div className="w-full">

        {/* Overall Stats Section */}
        {!error && (activeInitiatives.length > 0 || cycles.length > 0) && (
          <div className="mb-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-[90%] mx-auto justify-items-center">
              
              {/* Active Initiatives Summary */}
              <div className="col-span-2 lg:col-span-4 text-center">
                <div className="text-3xl lg:text-4xl font-medium text-[var(--theme-text-primary)] tv-text-enhanced">
                  {activeInitiatives.length} Active Initiatives • {completedProjects}/{totalProjects} Projects Complete
                </div>
              </div>


              {/* Cycle Progress */}
              {activeCycles.length > 0 && (
                <div className="bg-[var(--theme-card-bg)] p-6 sm:p-8 lg:p-10 rounded-2xl shadow-lg border-2 border-[var(--theme-border)] tv-card text-center">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-4xl lg:text-5xl xl:text-6xl font-bold text-[var(--status-green)] tv-text-enhanced">
                      {avgCycleProgress}%
                    </div>
                    <PieChart 
                      percentage={avgCycleProgress} 
                      health="onTrack"
                      size={48}
                    />
                  </div>
                  <div className="text-2xl lg:text-3xl font-medium text-[var(--theme-text-primary)] tv-text-enhanced mt-2">
                    Avg Cycle Progress
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 text-red-300 bg-red-900/20 border border-red-700/50 rounded-md p-4 w-full text-center shadow-sm">
            <p className="font-semibold text-lg">Error loading initiatives:</p>
            <p className="text-lg">{error}</p>
            {error.includes("API key") && <p className="mt-2 text-base">Please ensure your `LINEAR_API_KEY` in `.env.local` is correct and the file is saved. You might need to restart the development server.</p>}
          </div>
        )}

        {!error && activeInitiatives.length === 0 && (
          <div className="text-center text-[var(--theme-text-secondary)] bg-[var(--theme-card-bg)] p-6 rounded-lg shadow border border-[var(--theme-border)]">
             <p className="text-lg">No active initiatives found.</p>
             <p className="text-base mt-2">Check Linear or ensure initiatives have the status &apos;Active&apos;.</p>
           </div>
        )}

        {!error && cycles.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-col gap-3 w-full max-w-[75%] mx-auto">
              {cycles
                .filter(cycle => cycle.isActive)
                .map((cycle) => (
                  <div key={cycle.name} className="bg-[var(--theme-card-bg)] p-3 sm:p-4 rounded-lg shadow border border-[var(--theme-border)] hover:border-gray-500">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-text-primary)]">
                          {cycle.name}
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-medium text-[var(--theme-text-primary)]">
                            {Math.round(cycle.progress * 100)}% complete
                          </span>
                        </div>
                        <PieChart 
                          percentage={cycle.progress * 100} 
                          health="onTrack"
                          size={32}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!error && activeInitiatives.length > 0 && (
          <div className="w-full max-w-[90%] mx-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--theme-border)]">
                  <th className="text-left p-4 text-3xl lg:text-4xl font-normal text-[var(--theme-text-primary)] tv-text-enhanced">Initiative</th>
                  <th className="text-right p-4 text-3xl lg:text-4xl font-normal text-[var(--theme-text-primary)] tv-text-enhanced">Target Date</th>
                  <th className="text-right p-4 text-3xl lg:text-4xl font-normal text-[var(--theme-text-primary)] tv-text-enhanced">Progress</th>
                </tr>
              </thead>
              <tbody>
                {activeInitiatives
                  .sort((a, b) => {
                    // First, sort by completion status (active first, completed last)
                    if (a.isCompleted !== b.isCompleted) {
                      return a.isCompleted ? 1 : -1;
                    }

                    // If both have same completion status, sort by target date
                    // Handle null/undefined target dates - put them at the bottom
                    if (!a.targetDate && !b.targetDate) return 0;
                    if (!a.targetDate) return 1;
                    if (!b.targetDate) return -1;

                    // Convert TimelessDate objects to comparable dates
                    const getComparableDate = (targetDate: unknown) => {
                      if (typeof targetDate === 'object' && targetDate !== null && 'year' in targetDate && 'month' in targetDate && 'day' in targetDate) {
                        const td = targetDate as { year: number; month: number; day: number };
                        return new Date(td.year, td.month - 1, td.day);
                      }
                      if (typeof targetDate === 'string') {
                        return new Date(targetDate);
                      }
                      return new Date(0); // fallback
                    };

                    const dateA = getComparableDate(a.targetDate);
                    const dateB = getComparableDate(b.targetDate);

                    // Sort by nearest to furthest (ascending order)
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map(({ initiative, completionPercentage, completedProjectCount, totalProjectCount, targetDate, isCompleted }) => {
                    const isGlass = initiative.name.toLowerCase().includes('glass');
                    return (
                      <tr key={initiative.id} className={`border-b border-[var(--theme-border)] hover:bg-[var(--theme-card-bg)] ${isCompleted ? 'opacity-70' : ''} ${isGlass ? 'glass-effect shimmer-effect' : ''}`}>
                        <td className="p-4">
                          <span className={`text-4xl sm:text-5xl lg:text-6xl font-normal ${isGlass ? 'rainbow-text' : 'text-[var(--theme-text-primary)] tv-text-enhanced'}`}>
                            {renderInitiativeTitle(initiative.name)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {isCompleted ? (
                            <span className="text-2xl lg:text-3xl text-[var(--status-green)] tv-text-enhanced">
                              ✓ COMPLETED
                            </span>
                          ) : targetDate ? (
                            <div className="text-2xl lg:text-3xl tv-text-enhanced text-[var(--theme-text-secondary)]">
                              {formatTargetDate(targetDate)}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-4">
                            <span className="text-2xl lg:text-3xl text-[var(--theme-text-secondary)] tv-text-enhanced">
                              {completedProjectCount}/{totalProjectCount}
                            </span>
                            <FuelGauge percentage={completionPercentage} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default async function Page() {
  try {
    const [initiatives, cycles] = await Promise.all([
      getActiveAndRecentInitiatives(),
      getCycles()
    ]);
    return <HomePage activeInitiatives={initiatives} cycles={cycles} />;
  } catch (e: unknown) {
    let errorMessage = "An unknown error occurred.";
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    console.error("Failed to load data for Page:", errorMessage);
    return <HomePage activeInitiatives={[]} cycles={[]} error={errorMessage} />;
  }
}

export const revalidate = 3600; // Revalidate every hour to avoid rate limiting
