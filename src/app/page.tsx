import React from 'react'; // Add React import
import { LinearClient, Initiative, Project, ProjectStatus } from "@linear/sdk"; // Remove StringComparator import
import { FiPackage } from 'react-icons/fi'; // Box icon for Delivery
import { FaSeedling } from 'react-icons/fa'; // Sprout icon for Growth
import { GiBrickWall } from 'react-icons/gi'; // Bricks icon for Foundation
import AutoRefresher from '@/components/AutoRefresher'; // Import the client component

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
    const completionStatuses = new Set(['Completed', 'Canceled', 'Postponed']);
    const processedInitiatives: InitiativeWithProjects[] = [];
    let hasNextPage = true;
    let afterCursor: string | undefined = undefined;

    console.log("Fetching active initiatives with projects and statuses...");

    // Loop to handle pagination for initiatives
    while (hasNextPage) {
      // Attempt to fetch initiatives with nested projects and statuses
      // Using server-side filtering and requesting nested data
      // NOTE: The exact syntax for fetching nested relations (_relations/include/fields)
      // might differ based on the SDK version and specifics. This is an educated guess.
      const initiativesConnection = await client.initiatives({
        first: 25, // Fetch in smaller batches to be safe
        after: afterCursor,
        // filter: { status: { name: { eq: 'Active' } } }, // Removed server-side filter
        // Removed unsupported _relations parameter
      });

      console.log(`Fetched page of initiatives. Has next: ${initiativesConnection.pageInfo.hasNextPage}. Nodes: ${initiativesConnection.nodes.length}`);

      // Filter for active initiatives *client-side* after fetching batch
      const activeInitiativesInBatch = initiativesConnection.nodes.filter(
        (initiative) => initiative.status === 'Active'
      );

      // Process the filtered batch of active initiatives
      for (const initiative of activeInitiativesInBatch) { // Loop over filtered batch
        let projectsWithStatus: ProjectWithStatus[] = [];
        let completedProjectCount = 0;
        let totalProjectCount = 0;

        try {
          // Access projects - hopefully pre-fetched
          // The exact access method might depend on how the SDK handles nested fetches.
          // Using `await initiative.projects()` as a robust way that might
          // return pre-fetched data or fetch if needed/not pre-fetched.
          const projectConnection = await initiative.projects({ first: 100 }); // Fetch projects for this initiative (adjust 'first' if needed)
          const projects = projectConnection.nodes ?? [];
          totalProjectCount = projects.length;

          // Process projects to get status (hope it's fast/cached due to parent query)
          for (const project of projects) {
            let status: ProjectStatus | null = null;
            try {
              // Still need to await status, but hope the SDK optimizes this
              // if the data was part of the initial nested fetch.
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
          // Assign empty projects array if fetching/processing fails
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

      // Update pagination state
      hasNextPage = initiativesConnection.pageInfo.hasNextPage;
      afterCursor = initiativesConnection.pageInfo.endCursor;
      if (hasNextPage) {
         console.log("Fetching next page of initiatives...");
         // Optional: Add a small delay here if needed
         // await new Promise(resolve => setTimeout(resolve, 200)); // e.g., 200ms delay
      }
    } // End while loop for initiative pagination

    // Sort final results
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
      // Re-throw specific types of errors if needed, or just log
      throw new Error(`Failed to fetch initiatives from Linear: ${error.message}`);
    } else {
      throw new Error("An unknown error occurred while fetching initiatives.");
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
      <AutoRefresher /> {/* Add the client component to trigger refreshes */}
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
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400"> 
                      Last Updated: {new Date(initiative.updatedAt).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
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
                                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-500 dark:text-gray-400 ml-3.5"> {/* Indent list slightly */}
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

                </div>

              </div> // End of initiative card div
            ))}
          </div> // End of restored div wrapper
        )}
      </div>
    </main>
  );
}

// Revalidate the page every 10 minutes (600 seconds)
export const revalidate = 600;
