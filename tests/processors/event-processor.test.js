const { EventProcessor } = require('../../src/processors/event-processor');

// Mock @actions/github
jest.mock('@actions/github', () => ({
  context: {
    eventName: 'push',
    payload: {},
    ref: 'refs/heads/main',
    sha: 'abc123',
    actor: 'testuser',
    workflow: 'CI',
    job: 'build',
    runId: 123,
    runNumber: 1
  }
}));

describe('EventProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new EventProcessor();
  });

  describe('processEvent', () => {
    it('should process push event correctly', async () => {
      // Arrange
      processor.context = {
        eventName: 'push',
        payload: {
          commits: [{ id: 'abc123', message: 'Test commit' }],
          pusher: { name: 'testuser' },
          forced: false
        },
        ref: 'refs/heads/main',
        sha: 'abc123',
        actor: 'testuser',
        workflow: 'CI',
        job: 'build',
        runId: 123,
        runNumber: 1
      };

      // Act
      const result = await processor.processEvent();

      // Assert
      expect(result.eventName).toBe('push');
      expect(result.branch).toBe('main');
      expect(result.isMainBranch).toBe(true);
      expect(result.shouldDeploy).toBe(true);
      expect(result.deploymentTarget).toBe('production');
      expect(result.commits).toHaveLength(1);
    });

    it('should process pull request event correctly', async () => {
      // Arrange
      processor.context = {
        eventName: 'pull_request',
        payload: {
          action: 'opened',
          pull_request: {
            number: 42,
            title: 'Test PR',
            body: 'Test description',
            base: { ref: 'main' },
            head: { ref: 'feature/test' },
            user: { login: 'testuser' },
            draft: false,
            mergeable: true
          }
        },
        ref: 'refs/pull/42/merge',
        sha: 'def456',
        actor: 'testuser'
      };

      // Act
      const result = await processor.processEvent();

      // Assert
      expect(result.eventName).toBe('pull_request');
      expect(result.action).toBe('opened');
      expect(result.pullRequest.number).toBe(42);
      expect(result.pullRequest.baseBranch).toBe('main');
      expect(result.pullRequest.headBranch).toBe('feature/test');
      expect(result.shouldRunTests).toBe(true);
      expect(result.shouldDeploy).toBe(false);
    });

    it('should process release event correctly', async () => {
      // Arrange
      processor.context = {
        eventName: 'release',
        payload: {
          action: 'published',
          release: {
            tag_name: 'v1.0.0',
            name: 'Release 1.0.0',
            body: 'Release notes',
            prerelease: false,
            draft: false,
            author: { login: 'testuser' }
          }
        },
        ref: 'refs/tags/v1.0.0',
        sha: 'ghi789',
        actor: 'testuser'
      };

      // Act
      const result = await processor.processEvent();

      // Assert
      expect(result.eventName).toBe('release');
      expect(result.action).toBe('published');
      expect(result.release.tagName).toBe('v1.0.0');
      expect(result.shouldDeploy).toBe(true);
      expect(result.deploymentTarget).toBe('production');
      expect(result.shouldRunFullSuite).toBe(true);
    });

    it('should process workflow dispatch event correctly', async () => {
      // Arrange
      processor.context = {
        eventName: 'workflow_dispatch',
        payload: {
          inputs: {
            environment: 'staging',
            skipTests: 'false'
          },
          sender: { login: 'testuser' }
        },
        ref: 'refs/heads/main',
        sha: 'jkl012',
        actor: 'testuser'
      };

      // Act
      const result = await processor.processEvent();

      // Assert
      expect(result.eventName).toBe('workflow_dispatch');
      expect(result.inputs.environment).toBe('staging');
      expect(result.isManualTrigger).toBe(true);
      expect(result.actor).toBe('testuser');
    });
  });

  describe('branch detection methods', () => {
    it('should correctly identify main branches', () => {
      expect(processor.isMainBranch('refs/heads/main')).toBe(true);
      expect(processor.isMainBranch('refs/heads/master')).toBe(true);
      expect(processor.isMainBranch('refs/heads/develop')).toBe(false);
    });

    it('should correctly identify develop branches', () => {
      expect(processor.isDevelopBranch('refs/heads/develop')).toBe(true);
      expect(processor.isDevelopBranch('refs/heads/development')).toBe(true);
      expect(processor.isDevelopBranch('refs/heads/main')).toBe(false);
    });

    it('should correctly identify feature branches', () => {
      expect(processor.isFeatureBranch('refs/heads/feature/new-login')).toBe(true);
      expect(processor.isFeatureBranch('refs/heads/feat/api-update')).toBe(true);
      expect(processor.isFeatureBranch('refs/heads/main')).toBe(false);
    });

    it('should correctly identify hotfix branches', () => {
      expect(processor.isHotfixBranch('refs/heads/hotfix/security-patch')).toBe(true);
      expect(processor.isHotfixBranch('refs/heads/main')).toBe(false);
    });
  });

  describe('deployment logic', () => {
    it('should determine correct deployment targets', () => {
      expect(processor.getDeploymentTarget('refs/heads/main')).toBe('production');
      expect(processor.getDeploymentTarget('refs/heads/develop')).toBe('development');
      expect(processor.getDeploymentTarget('refs/heads/hotfix/fix')).toBe('staging');
      expect(processor.getDeploymentTarget('refs/heads/feature/test')).toBe(null);
    });

    it('should determine when deployment should occur', () => {
      expect(processor.shouldDeploy('refs/heads/main')).toBe(true);
      expect(processor.shouldDeploy('refs/heads/develop')).toBe(true);
      expect(processor.shouldDeploy('refs/heads/hotfix/fix')).toBe(true);
      expect(processor.shouldDeploy('refs/heads/feature/test')).toBe(false);
    });
  });

  describe('extractBranchName', () => {
    it('should extract branch names correctly', () => {
      expect(processor.extractBranchName('refs/heads/main')).toBe('main');
      expect(processor.extractBranchName('refs/heads/feature/test')).toBe('feature/test');
      expect(processor.extractBranchName('refs/tags/v1.0.0')).toBe('v1.0.0');
      expect(processor.extractBranchName('main')).toBe('main');
    });
  });
});