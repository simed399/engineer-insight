import { useState } from 'react';
import { useTickets, useGenerateOnboardingPlan, useApiKeyStatus } from '../hooks/useOnboardingPlan';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { AlertCircle, Loader2, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

export function OnboardingGenerator() {
  const { data: ticketsData, isLoading: loadingTickets, error: ticketsError } = useTickets();
  const { mutate: generatePlan, isPending, data: plan, error: generateError } = useGenerateOnboardingPlan();
  const { isConfigured } = useApiKeyStatus();
  
  const [role, setRole] = useState('');
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (taskId: string, task?: any) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        // Unchecking - just remove this item
        newSet.delete(taskId);
      } else {
        // Checking - add this item
        newSet.add(taskId);
        
        // If it's a subtask with sub-subtasks, check all sub-subtasks too
        if (task && task.subsubtasks && task.subsubtasks.length > 0) {
          task.subsubtasks.forEach((step: any) => {
            newSet.add(step.id);
          });
        }
      }
      return newSet;
    });
  };

  const isSubtaskAutoCompleted = (subtask: any, completedSet: Set<string>) => {
    // If subtask has sub-subtasks, check if all are completed
    if (subtask.subsubtasks && subtask.subsubtasks.length > 0) {
      return subtask.subsubtasks.every((step: any) => completedSet.has(step.id));
    }
    return false;
  };

  const isTaskAutoCompleted = (task: any, completedSet: Set<string>) => {
    // If task has subtasks, check if all are completed (manually or auto-completed)
    if (task.subtasks && task.subtasks.length > 0) {
      return task.subtasks.every((subtask: any) => 
        completedSet.has(subtask.id) || isSubtaskAutoCompleted(subtask, completedSet)
      );
    }
    return false;
  };

  const parseRoadmap = (rawText: string) => {
    const sections: any = {
      roleSummary: '',
      keyResponsibilities: '',
      weeks: []
    };

    // Extract Role Summary
    const roleSummaryMatch = rawText.match(/Role Summary[:\s]*([\s\S]*?)(?=Key Responsibilities|Onboarding Objectives|Week 1|$)/i);
    if (roleSummaryMatch) {
      sections.roleSummary = roleSummaryMatch[1].trim();
    }

    // Extract Key Responsibilities
    const keyRespMatch = rawText.match(/Key Responsibilities[:\s]*([\s\S]*?)(?=Week 1|Onboarding Objectives|Detailed Onboarding Plan|$)/i);
    if (keyRespMatch) {
      sections.keyResponsibilities = keyRespMatch[1].trim();
    }

    // Extract and consolidate all Week tasks
    const weekMap = new Map<string, any[]>();
    
    const lines = rawText.split('\n');
    let currentWeek: string | null = null;
    let currentTask: any = null;
    let currentSubtask: any = null;
    let inWeekSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this is a Week header (handle markdown bold **Week X**)
      const weekMatch = trimmed.match(/^\*?\*?Week\s+(\d+)\*?\*?/i);
      if (weekMatch) {
        // Save previous task
        if (currentTask && currentWeek) {
          weekMap.get(currentWeek)!.push(currentTask);
          currentTask = null;
          currentSubtask = null;
        }
        
        currentWeek = weekMatch[1];
        if (!weekMap.has(currentWeek)) {
          weekMap.set(currentWeek, []);
        }
        inWeekSection = true;
        continue;
      }
      
      // Stop parsing weeks if we hit these sections
      if (/^(Milestones|Knowledge Requirements|Risks)/i.test(trimmed)) {
        inWeekSection = false;
        if (currentTask && currentWeek) {
          weekMap.get(currentWeek)!.push(currentTask);
          currentTask = null;
          currentSubtask = null;
        }
        continue;
      }
      
      // Skip if we're not in a week section
      if (!currentWeek || !inWeekSection) continue;
      
      // Empty line might indicate end of current task
      if (trimmed.length === 0) {
        if (currentTask && currentWeek && currentTask.subtasks.length > 0) {
          weekMap.get(currentWeek)!.push(currentTask);
          currentTask = null;
          currentSubtask = null;
        }
        continue;
      }
      
      // Check if it's a bullet point (starts with -, *, or bullet)
      if (/^[-*•]\s+/.test(trimmed)) {
        if (currentTask && currentTask.isValidTask) {
          const bulletText = trimmed.replace(/^[-*•]\s+/, '').trim();
          
          // Check if this is a Subtask
          if (/^Subtask\s+/i.test(bulletText)) {
            const cleanText = bulletText.replace(/^Subtask\s+\d*:?\s*/i, '');
            if (cleanText.length > 0) {
              currentSubtask = {
                id: `${currentTask.id}-sub${currentTask.subtasks.length + 1}`,
                text: cleanText,
                subsubtasks: []
              };
              currentTask.subtasks.push(currentSubtask);
            }
          } else if (currentSubtask && /^Step\s+/i.test(bulletText)) {
            // This is a sub-subtask (Step) under the current subtask
            const cleanText = bulletText.replace(/^Step\s+\d*:?\s*/i, '');
            if (cleanText.length > 0) {
              currentSubtask.subsubtasks.push({
                id: `${currentSubtask.id}-step${currentSubtask.subsubtasks.length + 1}`,
                text: cleanText
              });
            }
          }
          // Ignore other bullet points that don't match Subtask or Step pattern
        }
      } else if (trimmed.length > 0) {
        // It's a task header
        // Check if it starts with **Task (that's what we want as tasks)
        const isTaskHeader = /^\*\*Task\s+/i.test(trimmed);
        
        // Only create task if it starts with **Task
        if (isTaskHeader) {
          // Save previous task
          if (currentTask && currentTask.subtasks.length > 0) {
            weekMap.get(currentWeek)!.push(currentTask);
          }
          
          // Start new task
          currentTask = {
            id: `week${currentWeek}-task${weekMap.get(currentWeek)!.length + 1}`,
            title: trimmed.replace(/^\*\*Task\s*\d*:?\*\*\s*/i, '').replace(/\*\*/g, ''),
            subtasks: [],
            isValidTask: true
          };
          currentSubtask = null;
        } else {
          // Not a task header, ignore it
          // Don't reset currentTask, just skip this line
        }
      }
    }
    
    // Push last task if exists
    if (currentTask && currentWeek && currentTask.subtasks.length > 0) {
      weekMap.get(currentWeek)!.push(currentTask);
    }
    
    // Convert map to sorted array
    const sortedWeeks = Array.from(weekMap.entries())
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([weekNum, tasks]) => ({
        weekNum,
        tasks: tasks.filter(task => task.subtasks.length > 0)
      }))
      .filter(week => week.tasks.length > 0);
    
    sections.weeks = sortedWeeks;
    return sections;
  };

  const calculateProgress = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return 0;
    
    // Only count items that are actually displayed
    const allCheckableItems: string[] = [];
    
    tasks.forEach((task: any) => {
      // Add task ID
      allCheckableItems.push(task.id);
      
      // Add subtask IDs
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask: any) => {
          allCheckableItems.push(subtask.id);
          
          // Add sub-subtask (step) IDs
          if (subtask.subsubtasks && subtask.subsubtasks.length > 0) {
            subtask.subsubtasks.forEach((step: any) => {
              allCheckableItems.push(step.id);
            });
          }
        });
      }
    });
    
    if (allCheckableItems.length === 0) return 0;
    
    const completed = allCheckableItems.filter(id => {
      // Check if manually completed
      if (completedTasks.has(id)) return true;
      
      // Check if it's a task that's auto-completed
      const task = tasks.find((t: any) => t.id === id);
      if (task && isTaskAutoCompleted(task, completedTasks)) return true;
      
      // Check if it's a subtask that's auto-completed
      const subtask = tasks
        .flatMap((t: any) => t.subtasks || [])
        .find((s: any) => s.id === id);
      if (subtask && isSubtaskAutoCompleted(subtask, completedTasks)) return true;
      
      return false;
    }).length;
    
    return Math.round((completed / allCheckableItems.length) * 100);
  };

  const calculateTaskProgress = (task: any) => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    
    const allCheckableItems: string[] = [];
    
    // Add subtask IDs
    task.subtasks.forEach((subtask: any) => {
      allCheckableItems.push(subtask.id);
      
      // Add sub-subtask (step) IDs
      if (subtask.subsubtasks && subtask.subsubtasks.length > 0) {
        subtask.subsubtasks.forEach((step: any) => {
          allCheckableItems.push(step.id);
        });
      }
    });
    
    if (allCheckableItems.length === 0) return 0;
    
    const completed = allCheckableItems.filter(id => {
      // Check if manually completed
      if (completedTasks.has(id)) return true;
      
      // Check if it's a subtask that's auto-completed
      const subtask = task.subtasks.find((s: any) => s.id === id);
      if (subtask && isSubtaskAutoCompleted(subtask, completedTasks)) return true;
      
      return false;
    }).length;
    
    return Math.round((completed / allCheckableItems.length) * 100);
  };

  const handleGenerate = () => {
    generatePlan({
      tickets: ticketsData?.tickets || [],
      role: role || undefined,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Roadmap Generator</CardTitle>
          <CardDescription>
            Enter the engineer role to generate a personalized onboarding roadmap
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key Status */}
          {!isConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>API Key Required</AlertTitle>
              <AlertDescription>
                Please add your Gemini API key in <code>src/lib/geminiService.ts</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Tickets Status */}
          {loadingTickets && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {ticketsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Tickets</AlertTitle>
              <AlertDescription>{ticketsError.message}</AlertDescription>
            </Alert>
          )}

          {/* Input Field */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium mb-2">
              Engineer Role
            </label>
            <input
              id="role"
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g., Frontend Developer, Backend Engineer, DevOps Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!isConfigured || loadingTickets || isPending || !role.trim()}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Roadmap'
            )}
          </Button>

          {/* Error Display */}
          {generateError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Generation Error</AlertTitle>
              <AlertDescription>{generateError.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Onboarding Roadmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const roadmap = parseRoadmap(plan.raw);
              const totalProgress = calculateProgress(roadmap.weeks.flatMap((w: any) => w.tasks));
              
              // Debug logging
              console.log('Raw text:', plan.raw);
              console.log('Parsed roadmap:', roadmap);
              console.log('Weeks found:', roadmap.weeks.length);

              return (
                <>
                  {/* Overall Progress */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <span className="text-sm font-medium">{totalProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          totalProgress === 0 ? 'bg-gray-300' :
                          totalProgress < 25 ? 'bg-red-500' :
                          totalProgress < 50 ? 'bg-orange-500' :
                          totalProgress < 75 ? 'bg-yellow-500' :
                          totalProgress < 100 ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${totalProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Role Summary */}
                  {roadmap.roleSummary && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <h3 className="font-semibold text-lg">Role Summary</h3>
                        <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 px-4">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{roadmap.roleSummary}</p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Key Responsibilities */}
                  {roadmap.keyResponsibilities && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <h3 className="font-semibold text-lg">Key Responsibilities</h3>
                        <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 px-4">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{roadmap.keyResponsibilities}</p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Week Tasks */}
                  {roadmap.weeks.map((week: any) => {
                    const weekProgress = calculateProgress(week.tasks);
                    // Determine color based on progress
                    const getProgressColor = (progress: number) => {
                      if (progress === 0) return 'text-gray-300';
                      if (progress < 25) return 'text-red-500';
                      if (progress < 50) return 'text-orange-500';
                      if (progress < 75) return 'text-yellow-500';
                      if (progress < 100) return 'text-blue-500';
                      return 'text-green-500';
                    };
                    const progressColor = getProgressColor(weekProgress);
                    
                    return (
                      <Collapsible key={week.weekNum}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">Week {week.weekNum}</h3>
                            <div className="w-12 h-12 rounded-full border-3 border-gray-200 flex items-center justify-center relative">
                              <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  className={progressColor}
                                  strokeDasharray={`${2 * Math.PI * 20}`}
                                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - weekProgress / 100)}`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="text-xs font-bold">{weekProgress}%</span>
                            </div>
                          </div>
                          <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4 px-4 space-y-3">
                          {week.tasks.map((task: any) => {
                            const taskProgress = calculateTaskProgress(task);
                            const getProgressColor = (progress: number) => {
                              if (progress === 0) return 'text-gray-300';
                              if (progress < 25) return 'text-red-500';
                              if (progress < 50) return 'text-orange-500';
                              if (progress < 75) return 'text-yellow-500';
                              if (progress < 100) return 'text-blue-500';
                              return 'text-green-500';
                            };
                            const taskProgressColor = getProgressColor(taskProgress);
                            
                            return (
                            <Collapsible key={task.id}>
                              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-background rounded-md hover:bg-muted/50 transition-colors">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTask(task.id);
                                  }}
                                  className="flex-shrink-0"
                                >
                                  {(completedTasks.has(task.id) || isTaskAutoCompleted(task, completedTasks)) ? (
                                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>
                                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                <span className="font-medium text-sm text-left flex-1">{task.title}</span>
                                <div className="w-10 h-10 rounded-full border-3 border-gray-200 flex items-center justify-center relative flex-shrink-0 ml-2">
                                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle
                                      cx="20"
                                      cy="20"
                                      r="16"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                      className={taskProgressColor}
                                      strokeDasharray={`${2 * Math.PI * 16}`}
                                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - taskProgress / 100)}`}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <span className="text-xs font-bold">{taskProgress}%</span>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-2 pl-6 space-y-2">
                                {task.subtasks.map((subtask: any) => (
                                  <Collapsible key={subtask.id}>
                                    <div className="space-y-1">
                                      <div className="flex items-start gap-2">
                                        <button
                                          onClick={() => toggleTask(subtask.id, subtask)}
                                          className="mt-0.5 flex-shrink-0"
                                        >
                                          {(completedTasks.has(subtask.id) || isSubtaskAutoCompleted(subtask, completedTasks)) ? (
                                            <CheckCircle2 className="h-5 w-5 text-blue-500" />
                                          ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground" />
                                          )}
                                        </button>
                                        <div className="flex items-center gap-1 flex-1">
                                          {subtask.subsubtasks && subtask.subsubtasks.length > 0 && (
                                            <CollapsibleTrigger className="p-0.5">
                                              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                            </CollapsibleTrigger>
                                          )}
                                          <span className="text-sm">
                                            {subtask.text}
                                          </span>
                                        </div>
                                      </div>
                                      {/* Sub-subtasks (Steps) */}
                                      {subtask.subsubtasks && subtask.subsubtasks.length > 0 && (
                                        <CollapsibleContent className="pl-7 space-y-1 pt-1">
                                          {subtask.subsubtasks.map((step: any) => (
                                            <div key={step.id} className="flex items-start gap-2">
                                              <button
                                                onClick={() => toggleTask(step.id)}
                                                className="mt-0.5 flex-shrink-0"
                                              >
                                                {completedTasks.has(step.id) ? (
                                                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                                ) : (
                                                  <Circle className="h-4 w-4 text-muted-foreground" />
                                                )}
                                              </button>
                                              <span className="text-xs">
                                                {step.text}
                                              </span>
                                            </div>
                                          ))}
                                        </CollapsibleContent>
                                      )}
                                    </div>
                                  </Collapsible>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
