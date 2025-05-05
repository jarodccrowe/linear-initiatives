import React from 'react'; // Add React import
import { LinearClient, Initiative, Project, ProjectStatus } from "@linear/sdk";
import { FiPackage } from 'react-icons/fi'; // Box icon for Delivery
import { FaSeedling } from 'react-icons/fa'; // Sprout icon for Growth
import { GiBrickWall } from 'react-icons/gi'; // Bricks icon for Foundation

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

  try {
    let allInitiatives: Initiative[] = [];
    let initiativesConnection = await client.initiatives({ first: 50 });
    allInitiatives = initiativesConnection.nodes;

    while (initiativesConnection.pageInfo.hasNextPage) {
      initiativesConnection = await initiativesConnection.fetchNext();
      allInitiatives.push(...initiativesConnection.nodes);
    }

    if (!allInitiatives.length) {
      console.log("No initiatives found in Linear.");
      return [];
    }

    const activeInitiatives = allInitiatives.filter(
      (initiative) => initiative.status === 'Active'
    );

    // Define project completion statuses
    const completionStatuses = new Set(['Completed', 'Canceled', 'Postponed']);

    const initiativesWithProjectsPromises = activeInitiatives.map(async (initiative): Promise<InitiativeWithProjects> => {
      let projectsWithStatus: ProjectWithStatus[] = [];
      let completionPercentage = 0;
      let completedProjectCount = 0;
      let totalProjectCount = 0;
      try {
        const projectConnection = await initiative.projects({first: 50}); // Fetch more projects if needed for accuracy

        totalProjectCount = projectConnection.nodes.length; // Store total count initially

        const projectsWithStatusPromises = projectConnection.nodes.map(async (project: Project): Promise<ProjectWithStatus> => {
          try {
            const fetchedStatus = await project.status; // Access the status getter directly (await)
            const status = fetchedStatus ?? null; // Assign null if fetchedStatus is undefined
            return { project, status };
          } catch (statusError) {
            console.error(`Error fetching status for project ${project.id} (${project.name}):`, statusError);
            return { project, status: null }; // Handle error fetching status
          }
        });
        projectsWithStatus = await Promise.all(projectsWithStatusPromises);

        // Calculate completion percentage and counts
        totalProjectCount = projectsWithStatus.length; // Update total count after promises resolve (in case some failed)
        if (totalProjectCount > 0) {
          completedProjectCount = projectsWithStatus.filter(
            ({ status }) => status && completionStatuses.has(status.name)
          ).length;
          completionPercentage = (completedProjectCount / totalProjectCount) * 100;
        }

      } catch (projectError) {
        console.error(`Error fetching projects for initiative ${initiative.id} (${initiative.name}):`, projectError);
        // Initiative returned with empty projects and 0% completion
      }
      // Return initiative, projects, and calculated values
      return { initiative, projects: projectsWithStatus, completionPercentage, completedProjectCount, totalProjectCount };
    });

    const resolvedInitiativesWithProjects = await Promise.all(initiativesWithProjectsPromises);

    resolvedInitiativesWithProjects.sort((a, b) => {
      const dateA = new Date(a.initiative.updatedAt).getTime();
      const dateB = new Date(b.initiative.updatedAt).getTime();
      return dateB - dateA;
    });

    console.log(`Fetched ${allInitiatives.length} total initiatives, found ${resolvedInitiativesWithProjects.length} active.`);
    return resolvedInitiativesWithProjects;

  } catch (error) {
    console.error("Error fetching initiatives from Linear:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to fetch initiatives from Linear: ${error.message}`);
    } else {
        throw new Error("An unknown error occurred while fetching initiatives from Linear.");
    }
  }
}

// Helper function to render title with icon
const renderInitiativeTitle = (name: string): JSX.Element => {
  const iconMap: { [key: string]: { icon: JSX.Element; className: string } } = {
    // Use the same neutral color for all icons
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
  return <>{name}</>; // No prefix found
};

export default async function HomePage() {
  let activeInitiatives: InitiativeWithProjects[] = []; // Use updated type
  let error: string | null = null;

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
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-gray-900 dark:text-gray-100 text-center">Active Initiatives</h1>

        {error && (
          <div className="mb-6 text-red-800 bg-red-100 border border-red-300 rounded-md p-4 w-full text-center shadow-sm dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
            <p className="font-semibold">Error loading initiatives:</p>
            <p>{error}</p>
            {error.includes("API key") && <p className="mt-2 text-sm">Please ensure your `LINEAR_API_KEY` in `.env.local` is correct and the file is saved. You might need to restart the development server.</p>}
          </div>
        )}

        {!error && activeInitiatives.length === 0 && (
          <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
             <p>No active initiatives found.</p>
             <p className="text-sm mt-2">Check Linear or ensure initiatives have the status &apos;Active&apos;.</p>
           </div>
        )}

        {!error && activeInitiatives.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeInitiatives.map(({ initiative, projects, completionPercentage, completedProjectCount, totalProjectCount }) => (
              <div key={initiative.id} className="bg-white p-5 sm:p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow duration-200 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600 flex flex-col"> {/* Ensure cards are flex columns */}
                {/* Use helper function for title and add flex styling */}
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center">
                  {renderInitiativeTitle(initiative.name)}
                </h2>
                <div>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base dark:text-gray-300">{initiative.description || <span className="text-gray-500 dark:text-gray-400 italic">No description provided.</span>}</p>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 space-y-2 sm:space-y-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                       Status: {initiative.status || 'Unknown'}
                    </span>
                    <span>Last Updated: {new Date(initiative.updatedAt).toLocaleDateString()} {new Date(initiative.updatedAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p><span className="font-medium text-gray-700 dark:text-gray-300">Target Date:</span> {initiative.targetDate || 'N/A'}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Progress ({completedProjectCount}/{totalProjectCount})</span> {/* Display counts */}
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{completionPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full dark:bg-blue-500"
                      style={{ width: `${completionPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {(() => { // Use IIFE to manage filtering and grouping logic
                    // Define statuses to display and their desired order
                    const displayStatuses = ['Planning', 'In Progress', 'Stalled', 'Ready'];
                    const statusSet = new Set(displayStatuses);

                    // Filter projects initially
                    const filteredProjects = projects.filter(({ status }) => 
                      status && statusSet.has(status.name)
                    );

                    // Group projects by status
                    const groupedProjects = filteredProjects.reduce<{ [key: string]: ProjectWithStatus[] }>((acc, projectStatus) => {
                      const statusName = projectStatus.status?.name;
                      if (statusName) {
                        if (!acc[statusName]) {
                          acc[statusName] = [];
                        }
                        // Keep original sorting within status group if needed, or sort here
                        acc[statusName].push(projectStatus);
                      }
                      return acc;
                    }, {});

                    let contentRendered = false;

                    // Define colors for status dots
                    const statusColorMap: { [key: string]: string } = {
                      'Planning': 'bg-blue-500',
                      'In Progress': 'bg-yellow-500',
                      'Ready': 'bg-green-500',
                      'Stalled': 'bg-orange-600', // Changed from red to dark orange
                    };

                    return (
                      <>
                        {displayStatuses.map(statusName => {
                          const projectsInGroup = groupedProjects[statusName];
                          if (projectsInGroup && projectsInGroup.length > 0) {
                            contentRendered = true; // Mark that we have content to render
                            const dotColor = statusColorMap[statusName] || 'bg-gray-300'; // Default color
                            return (
                              <div key={statusName} className="mb-3 last:mb-0"> {/* Add margin between status groups */}
                                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center">
                                  <span className={`w-2 h-2 ${dotColor} rounded-full mr-1.5 flex-shrink-0`}></span>
                                  {statusName}:
                                </h4>
                                <ul className="list-disc list-inside space-y-1 text-xs text-gray-500 dark:text-gray-400 ml-3.5"> {/* Indent list slightly */}
                                  {projectsInGroup.map(({ project }) => ( // Only need project here
                                    <li key={project.id}>
                                      {project.name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                          return null; // No projects for this status
                        })}
                        {/* If no content was rendered at all */}
                        {!contentRendered && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                            No projects in Planning, In Progress, Stalled, or Ready states.
                          </p>
                        )}
                      </>
                    );

                  })()}
                </div>

              </div> // End of initiative card div
            ))}
          </div> // End of restored div wrapper
        )}
      </div>
    </main>
  );
}

export const revalidate = 600;
