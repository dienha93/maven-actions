const core = require('@actions/core');
const github = require('@actions/github');

/**
 * Processes GitHub events and provides context for Maven operations
 */
class EventProcessor {
  constructor() {
    this.context = github.context;
  }

  /**
   * Process the current GitHub event and return relevant context
   */
  async processEvent() {
    const eventName = this.context.eventName;
    const payload = this.context.payload;
    
    core.info(`📋 Processing GitHub event: ${eventName}`);
    
    const eventContext = {
      eventName,
      payload,
      ref: this.context.ref,
      sha: this.context.sha,
      actor: this.context.actor,
      workflow: this.context.workflow,
      job: this.context.job,
      runId: this.context.runId,
      runNumber: this.context.runNumber
    };

    // Add event-specific processing
    switch (eventName) {
      case 'push':
        return this.processPushEvent(eventContext);
      case 'pull_request':
        return this.processPullRequestEvent(eventContext);
      case 'release':
        return this.processReleaseEvent(eventContext);
      case 'workflow_dispatch':
        return this.processWorkflowDispatchEvent(eventContext);
      case 'schedule':
        return this.processScheduleEvent(eventContext);
      default:
        return this.processGenericEvent(eventContext);
    }
  }

  /**
   * Process push events
   */
  processPushEvent(eventContext) {
    const { payload } = eventContext;
    
    return {
      ...eventContext,
      branch: this.extractBranchName(eventContext.ref),
      commits: payload.commits || [],
      pusher: payload.pusher,
      forced: payload.forced || false,
      isMainBranch: this.isMainBranch(eventContext.ref),
      isDevelopBranch: this.isDevelopBranch(eventContext.ref),
      isFeatureBranch: this.isFeatureBranch(eventContext.ref),
      isHotfixBranch: this.isHotfixBranch(eventContext.ref),
      shouldDeploy: this.shouldDeploy(eventContext.ref),
      deploymentTarget: this.getDeploymentTarget(eventContext.ref)
    };
  }

  /**
   * Process pull request events
   */
  processPullRequestEvent(eventContext) {
    const { payload } = eventContext;
    const pullRequest = payload.pull_request;
    
    return {
      ...eventContext,
      action: payload.action,
      pullRequest: {
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body,
        baseBranch: pullRequest.base.ref,
        headBranch: pullRequest.head.ref,
        author: pullRequest.user.login,
        draft: pullRequest.draft,
        mergeable: pullRequest.mergeable
      },
      shouldRunTests: true,
      shouldRunSecurityScan: true,
      shouldDeploy: false
    };
  }

  /**
   * Process release events
   */
  processReleaseEvent(eventContext) {
    const { payload } = eventContext;
    const release = payload.release;
    
    return {
      ...eventContext,
      action: payload.action,
      release: {
        tagName: release.tag_name,
        name: release.name,
        body: release.body,
        prerelease: release.prerelease,
        draft: release.draft,
        author: release.author.login
      },
      shouldDeploy: payload.action === 'published' && !release.prerelease,
      deploymentTarget: 'production',
      shouldRunFullSuite: true
    };
  }

  /**
   * Process workflow dispatch events
   */
  processWorkflowDispatchEvent(eventContext) {
    const { payload } = eventContext;
    
    return {
      ...eventContext,
      inputs: payload.inputs || {},
      actor: payload.sender?.login || eventContext.actor,
      isManualTrigger: true
    };
  }

  /**
   * Process schedule events
   */
  processScheduleEvent(eventContext) {
    return {
      ...eventContext,
      isScheduledRun: true,
      shouldRunFullSuite: true,
      shouldRunSecurityScan: true
    };
  }

  /**
   * Process generic events
   */
  processGenericEvent(eventContext) {
    core.warning(`Unhandled event type: ${eventContext.eventName}`);
    return eventContext;
  }

  /**
   * Extract branch name from ref
   */
  extractBranchName(ref) {
    if (ref.startsWith('refs/heads/')) {
      return ref.replace('refs/heads/', '');
    }
    if (ref.startsWith('refs/tags/')) {
      return ref.replace('refs/tags/', '');
    }
    return ref;
  }

  /**
   * Check if ref is main branch
   */
  isMainBranch(ref) {
    const branch = this.extractBranchName(ref);
    return ['main', 'master'].includes(branch);
  }

  /**
   * Check if ref is develop branch
   */
  isDevelopBranch(ref) {
    const branch = this.extractBranchName(ref);
    return ['develop', 'development'].includes(branch);
  }

  /**
   * Check if ref is feature branch
   */
  isFeatureBranch(ref) {
    const branch = this.extractBranchName(ref);
    return branch.startsWith('feature/') || branch.startsWith('feat/');
  }

  /**
   * Check if ref is hotfix branch
   */
  isHotfixBranch(ref) {
    const branch = this.extractBranchName(ref);
    return branch.startsWith('hotfix/');
  }

  /**
   * Determine if deployment should occur
   */
  shouldDeploy(ref) {
    return this.isMainBranch(ref) || this.isDevelopBranch(ref) || this.isHotfixBranch(ref);
  }

  /**
   * Get deployment target based on branch
   */
  getDeploymentTarget(ref) {
    if (this.isMainBranch(ref)) return 'production';
    if (this.isDevelopBranch(ref)) return 'development';
    if (this.isHotfixBranch(ref)) return 'staging';
    return null;
  }
}

module.exports = { EventProcessor };