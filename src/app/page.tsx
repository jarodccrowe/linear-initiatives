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

async function getActiveInitiatives(): Promise<InitiativeWithProjects[]> {
  if (!process.env.LINEAR_API_KEY) {
    console.error("Linear API key is not configured.");
    throw new Error("Linear API key is not configured. Please set LINEAR_API_KEY in your .env.local file.");
  }

  const client = new LinearClient({
    apiKey: process.env.LINEAR_API_KEY,
  });

  const filterOutKeywords = ["data assets", "core business", "maintenance", "demo"];

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
          <span className={`inline-block mr-2 ${className}`}>{icon}</span>
          {name.substring(prefix.length).trim()}
        </>
      );
    }
  }
  return <>{name}</>; 
};

export default async function HomePage() {
  let activeInitiatives: InitiativeWithProjects[] = []; 
  let error: string | null = null;
  const lastUpdated = new Date(); 

  try {
    activeInitiatives = await getActiveInitiatives();
  } catch (err: unknown) {
    if (err instanceof Error) {
      error = err.message;
    } else {
      error = "An unexpected error occurred.";
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <AutoRefresher /> 
      <div className="text-right text-sm text-gray-500 dark:text-gray-400 mb-4">
        Last Updated: {lastUpdated.toLocaleString()} 
      </div>
      <div className="w-full">
        <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-gray-900 dark:text-gray-100 text-center">Active Initiatives</h1>

        {error && (
          <div className="mb-6 text-red-800 bg-red-100 border border-red-300 rounded-md p-4 w-full text-center shadow-sm dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
            <p className="font-semibold text-base">Error loading initiatives:</p>
            <p className="text-base">{error}</p>
            {error.includes("API key") && <p className="mt-2 text-sm">Please ensure your `LINEAR_API_KEY` in `.env.local` is correct and the file is saved. You might need to restart the development server.</p>}
          </div>
        )}

        {!error && activeInitiatives.length === 0 && (
          <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
             <p className="text-base">No active initiatives found.</p>
             <p className="text-sm mt-2">Check Linear or ensure initiatives have the status &apos;Active&apos;.</p>
           </div>
        )}

        {!error && activeInitiatives.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeInitiatives.map(({ initiative, projects, completionPercentage, completedProjectCount, totalProjectCount }) => (
              <div key={initiative.id} className="bg-white p-5 sm:p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow duration-200 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600 flex flex-col"> 
                <h2 className="text-2xl sm:text-3xl font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center">
                  {renderInitiativeTitle(initiative.name)}
                </h2>
                <div>
                  <p className="text-gray-700 mb-4 text-base sm:text-lg dark:text-gray-300">{initiative.description || <span className="text-gray-500 dark:text-gray-400 italic">No description provided.</span>}</p>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm sm:text-base text-gray-500 dark:text-gray-400 space-y-2 sm:space-y-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                       Status: {initiative.status || 'Unknown'}
                    </span>
                    <span className="text-sm sm:text-base text-gray-500 dark:text-gray-400"> 
                      Last Updated: {new Date(initiative.updatedAt).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p><span className="font-medium text-gray-700 dark:text-gray-300">Target Date:</span> {initiative.targetDate || 'N/A'}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Progress ({completedProjectCount}/{totalProjectCount})</span> 
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{completionPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full dark:bg-blue-500"
                      style={{ width: `${completionPercentage}%` }}
                    ></div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {(() => { 
                      const displayStatuses = ['Planning', 'In Progress', 'Stalled', 'Ready'];
                      const statusSet = new Set(displayStatuses);

                      const filteredProjects = projects.filter(({ status }) => 
                        status && statusSet.has(status.name)
                      );

                      const groupedProjects = filteredProjects.reduce<{ [key: string]: ProjectWithStatus[] }>((acc, projectStatus) => {
                        const statusName = projectStatus.status?.name;
                        if (statusName) {
                          if (!acc[statusName]) {
                            acc[statusName] = [];
                          }
                          acc[statusName].push(projectStatus);
                        }
                        return acc;
                      }, {});

                      let contentRendered = false;

                      const statusColorMap: { [key: string]: string } = {
                        'Planning': 'bg-blue-500',
                        'In Progress': 'bg-yellow-500',
                        'Ready': 'bg-green-500',
                        'Stalled': 'bg-orange-600', 
                      };

                      return (
                        <>
                          {displayStatuses.map(statusName => {
                            const projectsInGroup = groupedProjects[statusName];
                            if (projectsInGroup && projectsInGroup.length > 0) {
                              contentRendered = true; 
                              const dotColor = statusColorMap[statusName] || 'bg-gray-300'; 
                              return (
                                <div key={statusName} className="mb-3 last:mb-0"> 
                                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center">
                                    <span className={`w-2 h-2 ${dotColor} rounded-full mr-1.5 flex-shrink-0`}></span>
                                    {statusName}:
                                  </h4>
                                  <ul className="list-disc list-inside space-y-1 text-base text-gray-500 dark:text-gray-400 ml-3.5"> 
                                    {projectsInGroup.map(({ project }) => ( 
                                      <li key={project.id}>
                                        {project.name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                            return null; 
                          })}
                          {!contentRendered && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No projects in Planning, In Progress, Stalled, or Ready states.
                            </p>
                          )}
                        </>
                      );

                    })()}
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

export const revalidate = 600;
