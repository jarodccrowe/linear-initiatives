import React, { JSX } from 'react'; 
import { LinearClient, Initiative, Project, ProjectStatus } from "@linear/sdk";
import { FiPackage } from 'react-icons/fi'; 
import { FaSeedling } from 'react-icons/fa'; 
import { GiBrickWall } from 'react-icons/gi'; 
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
}

interface HomePageProps {
  activeInitiatives: InitiativeWithProjects[];
  error?: string;
}

async function getActiveInitiatives(): Promise<InitiativeWithProjects[]> {
  if (!process.env.LINEAR_API_KEY) {
    console.error("Linear API key is not configured.");
    throw new Error("Linear API key is not configured. Please set LINEAR_API_KEY in your .env.local file.");
  }

  const client = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY,
  });

  const filterOutKeywords = ["data assets", "core business", "maintenance"];

  try {
    const completionStatuses = new Set(['Completed', 'Canceled', 'Postponed']);
    const processedInitiatives: InitiativeWithProjects[] = [];
    let hasNextPage = true;
    let afterCursor: string | undefined = undefined;

    console.log("Fetching active initiatives with projects and statuses...");

    while (hasNextPage) {
      const initiativesConnection = await client.initiatives({
        first: 25, 
        after: afterCursor,
      });

      console.log(`Fetched page of initiatives. Has next: ${initiativesConnection.pageInfo.hasNextPage}. Nodes: ${initiativesConnection.nodes.length}`);

      const activeInitiativesInBatch = initiativesConnection.nodes.filter(
        (initiative) => {
          if (initiative.status !== 'Active') return false;
          const initiativeNameLower = initiative.name.toLowerCase();
          const shouldFilterOut = filterOutKeywords.some(keyword => 
            initiativeNameLower.includes(keyword.toLowerCase())
          );
          if (shouldFilterOut) {
            console.log(`Filtering out initiative: "${initiative.name}" due to keyword match.`);
          }
          return !shouldFilterOut;
        }
      );

      for (const initiative of activeInitiativesInBatch) { 
        let projectsWithStatus: ProjectWithStatus[] = [];
        let completedProjectCount = 0;
        let totalProjectCount = 0;

        try {
          const projectConnection = await initiative.projects({ first: 100 }); 
          const projects = projectConnection.nodes ?? [];
          totalProjectCount = projects.length;

          for (const project of projects) {
            let status: ProjectStatus | null = null;
            try {
              const fetchedStatus = await project.status;
              status = fetchedStatus ?? null;
            } catch (statusError) {
              console.error(`Error fetching status for project ${project.id} (${project.name}):`, statusError);
            }
            projectsWithStatus.push({ project, status });
            if (status && completionStatuses.has(status.name)) {
              completedProjectCount++;
            }
          }
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
          totalProjectCount
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

    console.log(`Finished fetching. Processed ${processedInitiatives.length} active initiatives.`);
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

const renderInitiativeTitle = (name: string): JSX.Element => {
  const iconMap: { [key: string]: { icon: JSX.Element; className: string } } = {
    '[Delivery]': { icon: <FiPackage />, className: 'text-gray-500 dark:text-gray-400' },
    '[Growth]': { icon: <FaSeedling />, className: 'text-gray-500 dark:text-gray-400' },
    '[Foundation]': { icon: <GiBrickWall />, className: 'text-gray-500 dark:text-gray-400' },
  };

  for (const prefix in iconMap) {
    if (name.startsWith(prefix)) {
      const { icon, className } = iconMap[prefix];
      return (
        <>
          <span className={`inline-block mr-4 ${className}`}>{icon}</span>
          {name.substring(prefix.length).trim()}
        </>
      );
    }
  }
  return <>{name}</>; 
};

const HomePage: React.FC<HomePageProps> = ({ activeInitiatives, error }) => {
  const getProgressBarBgColor = (health: string | undefined) => {
    if (health === 'onTrack') return 'bg-[var(--status-green)]';
    if (health === 'atRisk') return 'bg-[var(--status-amber)]';
    if (health === 'offTrack') return 'bg-[var(--status-red)]';
    return 'bg-[var(--theme-text-secondary)]'; // Fallback color
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-[var(--theme-bg)] text-[var(--theme-text-primary)]">
      <AutoRefresher /> 
      <div className="w-full">
        <h1 className="text-5xl sm:text-6xl font-bold mb-8 text-[var(--theme-text-primary)] text-center">Initiatives</h1>

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

        {!error && activeInitiatives.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {activeInitiatives
              .sort((a, b) => b.completionPercentage - a.completionPercentage)
              .map(({ initiative, completionPercentage, completedProjectCount, totalProjectCount }) => (
              <div key={initiative.id} className="bg-[var(--theme-card-bg)] p-5 sm:p-6 rounded-lg shadow border border-[var(--theme-border)] hover:border-gray-500 flex flex-col"> 
                <h2 className="text-4xl sm:text-5xl font-semibold mb-3 text-[var(--theme-text-primary)] flex items-center">
                  {renderInitiativeTitle(initiative.name)}
                </h2>
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-base sm:text-lg text-[var(--theme-text-secondary)] space-y-2 sm:space-y-0">
                    {/* Status and Last Updated removed as per request */}
                  </div>
                  {/* Target Date display removed as per request */}
                </div>

                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xl sm:text-2xl font-medium text-[var(--theme-text-secondary)]">Completed ({completedProjectCount}/{totalProjectCount})</span> 
                  </div>
                  <div className="w-full bg-[var(--theme-border)] rounded-full h-1.5">
                    <div
                      className={`${getProgressBarBgColor(initiative.health)} h-1.5 rounded-full`}
                      style={{ width: `${completionPercentage}%` }}
                    ></div>
                  </div>
                </div>

              </div> 
            ))}
          </div> 
        )}
      </div>
    </main>
  );
}

export default async function Page() {
  try {
    const initiatives = await getActiveInitiatives();
    return <HomePage activeInitiatives={initiatives} />;
  } catch (e: unknown) {
    let errorMessage = "An unknown error occurred.";
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    console.error("Failed to load initiatives for Page:", errorMessage);
    return <HomePage activeInitiatives={[]} error={errorMessage} />;
  }
}

export const revalidate = 600;
