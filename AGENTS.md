# Purpose

We are working on a technical assessment piece as part of a job interview.  While the project itself is a toy problem, the code quality needs to be the same as when making a real project that will be deployed to production.

This project will be reviewed by people such as a CTO, an Engineering Manager, and several Senior developers, so I will be producing robust and well organized code that demonstrates that I know what is important in creating high quality code that is ready to ship.

# Tech Stack

Many of the decisions for this tech stack are already settled due to the requirements provided.  We will be using Vue.js 3.5+ for the front end.  I personally use the Composition API with Vue most of the time, but I want to be given the chance to consider using the Options API as I believe that is the API is used in this company.

Node.js with Express will be the backend framework.  I considered using Nuxt, but I think that since I don't need SSR and only need some simple API endpoints, that Express is the right tool for this project.

JavaScript is the main language to work with over TypeScript.  While TypeScript has many helpful features, it runs a risk of adding unhelpful complexity and causing friction for this application's success.

The bundler will be Vite, and the testing framework will be Vitest.  I want to consider whether it would be helpful to use Cypress or Supertest for any e2e testing.

We will use SQLite as the database due to the fact that it has the least complexity to set up and run for this use case, but also that it is still a real-world database that is well suited to storing app data that on a per-user basis.

# Workflow

We will be using the spec driven development workflow.  I will be leveraging your ability to help me explore the project goals and identify ambiguities that we can 'rubberduck' about and then I'll make the final informed decision once I know that I've explored the advantages, tradeoffs, and their alignment with the project goals.

## /docs/spec.md

Our decisions will worked out and then turned in to a spec.md file which will serve as a full reference on this project.  Any changes to plans will need to be updated and reflected in the spec to keep it current.

I will be showing you the technical assessment instructions and requirements, however I do not wish to include them in the repo so that they can stay private, so I want you to only keep knowledge of them in your memory.md file but not include them in any section of the repo's committed files (outside of the fact that the README.md or spec.md will be stating the things that the project is doing in order to fulfill these goals).


## /docs/plan.md

Once the spec has been finalized, I will ask you to then create an implementation plan called plan.md.  Plan.md will break the project implementation into distinct phases that start with making sure the back end data modeling and API functionality works first, and then moves on to making the UI with as nice of a UX that we can polish while knowing that the back end is in a fixed state of completion and won't need to be changed further.

The phases will then be broken down into steps and sub-steps, such that each individual sub-step is clear enough and of low enough complexity that it can be completed in a way that is easy to keep in mind, easy to roll back, and doesn't take a lot of investment of work before we can check that it has been completed successfully.

We will also be doing a final check-through on the end that all important considerations about app quality, user experience, a11y and Core Web Vitals have been at least considered, and that all test coverage is in place, though we will still include a moment in each phase to ensure that some testing foundations are covered alongside implementation so that the technical debt of having to create them doesn't balloon in a way that causes it to be done in a rush and miss something important.

This plan.md file will serve as a checklist of things that we need to do to realize the spec.md goals, and it will have check boxes like [ ] for each step and sub-step so that we can track out progress.

I will also be making additional notes myself in this plan.md file wherever it might add or help, and this file will also serve as a kind of runsheet that helps show the flow of action that was taken during the building of this project.

## /docs/findings-decisions-actions.md

While we are implementing our plan, if we find that something we intended to do ends up being infeasible or needs rethinking, such moments will be recorded as lines of text appended to this file, to serve as a way of tracing the evolution of the project as it went forward.

We will also be checking current documentation at each step to make sure that anything new going on with the technologies we are working with are known.  Your training cutoff date will ensure that most things that you currently know about these technologies will be at least a few minor versions behind if not more, we will be checking the documents first, and I want any findings of deltas between documentation and your training to be included as entries to this file.

## General workflow preferences

I will ask for your help to generate parts of the code that have lots of boilerplate or repetitive syntax with little decisionmaking needed, in order to save typing and write faster, but I will make edits myself to things that I can do faster than the time it takes to run a prompt, use up tokens, and wait for a response when I could just change it myself.

## Final quality and code ownership

I will be reviewing each line of code and fully understanding and signing off on it, so I want you to support me in making the application quickly and effectively, but nothing will be shipped until I have a total mental model of it that it is ready as a complete deliverable and there are no irrelevant patterns or unnecessary actions taking place in any area.

# Code Quality Priorities

## Logging

Steps taken by the application should be logged to the console so that it's easier to trace what is happening.  Assume that the console logs will be getting picked up by monitoring software that can handle it from there.

Logging on the client side needs to be helpful for the user to know what is wrong without exposing any important secrets to them.

Logging on the server side can be more informative in order to help developers troubleshoot and solve problems, however because the logs could get picked up and stored in files or databases by logging software, we must not include any sensitive information in those logs.

## Error handling

Any process that can fail (fetching, database reads, etc) needs to be put in a try/catch block, with reasonable handling of the possible thrown errors or failure cases, along with logging of each case.  Nothing is permitted to fail silently.

If the error can be handled gracefully by the application then we will do so, otherwise we will throw the error further up with whatever helpful information we can provide that does not expose secrets to any users to third parties.

## Authentication

Authentication is essential in production applications, but in this project we will use pseudocode comments to show where Auth would need to take place and how it would be done, but may not actually implement it, or else won't implement it until everything else is working first.

## User input validation and sanitization

All user input needs to be validated on the back end to make sure it is the expected data shape.

All user input also needs to be sanitized on the backend, to protect against SQL injection attacks as well as control characters and other typical safeguards.

If time permits, user input should also be validated on the front end to enhance UX so that their commands aren't sent to the backend unless we know that they're properly formed.


## Testing

It will need appropriate test coverage, both unit and e2e.  We normally prefer to use Test Driven Development where tests are made first, but as this project needs to be done in a short amount of time, we might do a mix of quick building and manual testing iteration where it will help us and then harden against regressions with ensuring that tests cover the happy path, edge cases, error states and failures, and malformed and malicious inputs.

## Simplicity with robustness

This application needs to be simple and not overengineered, but it should still be built with thought going into each decision such that it will be resistant to needing rewrites in the future when changes happen, as well as designing it in a way that can handle potential larger scale and load, such as having thousands of robot agents in it or a very large grid map to accomodate large instruction sets for far-reaching movement patterns.

In reality the application won't likely be exposed to this level of load, so we must not overengineer it.  We will favour decisions that get the job done fast, but will also take easy wins for future proofing whenever they're available.

## Documentation

### JSDoc

I will be putting JSDoc style strings over all functionality for the purpose of making it available to show up in hovering tooltips in the IDE.  I won't necessarily use other aspects of JSDoc documentation generation, but the project will at least be ready for that step to be an easy thing to take.

### Spec.md

We will be ingesting the objectives and requirements and then working through the intentionally ambiguous areas in order to come to sensible decisions that make the best interpretation of the intentions of the project, as there will be no way to perform additional requirements gathering for this.

The decisions and specifications will be captured in a spec.md file, that will contain a complete but easily readable representation of what is being built.  This spec will also be used as a reference, and will contain sections that cover each area, including the API spec for its endpoints, shape of its requests, shape of its responses, status codes.

So the spec.md file will be the document that states the essence of the application for our implementation plan, and it will also be a helpful reference that people can look to in order to quickly understand any detail about it that they might wish to know, grouped by topics that are easy to look up and get information about.

The spec file will cover details on each section of the application, and then at the end of each section, there will be a note that explains the alternative decisions that we explored, and what the advantages and tradeoffs for each of them were, and why we picked the choice that we did.  This will include things like why we picked Express over Nuxt, or why we chose to use a SPA for simplicity over using SSR even though SSR normally helps get better SEO.

# Presentation Priorities

## Runnable in any Unix environment

The final project needs to be able to run in any environment, so we will need to take steps to make sure this project can run on a fresh install in a Unix environment without any issues.

I'd like to make use of .nvm version files but I also will be using Docker containers as an alternative way ensure that the app can be run anywhere.

## README.md

The README.md file will explain clearly, concisely, and without any extra clutter or unneeded detail, how to use any tools or perform any setup steps needed to run the code.

It will have sections for:
- How to run it
- Things to try out
- Description of the API
- Reference to the spec.md file for full details

## Review and polish

If you notice any typos that I have made in any file, bring them to my attention.

If you notice any complicated phrasing or poorly or vaguely phrased writing, bring it to my attention.

At certain times, I will be giving you prompts to have you do a review of the application in its current state from the perspective of a CTO, from the perspective of an Engineering Manager, and from the perspective of a Senior developer who has to interact with the codebase, read it easily and make future changes to it easily.

We don't have to perform this review on every step, but I want it to perform it at reasonable checkpoints so that the changes and fixes to make to the code can be caught early and done before it gets to the point of needing to backtrack and rewrite or replan anything.


# Agent and Developer communication

I want your responses to me to be started with a section called "Conclusion (Read First)" that summarizes the essence of your response without losing any key information.

This is so that I can read responses and make fast followup decisions without having the cognitive fatigue of reading 3 - 5 paragraphs of detail each time.

I will then be able to write followup prompts more quickly, and iterate through ideas faster.  The details of the responses are still important to include after the conclusion section so that I can go deeper into the details whenever needed while you're busy taking time writing your next response.