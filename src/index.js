const core = require('@actions/core');
const { MavenActionHandler } = require('./handlers/maven-handler');
const { EventProcessor } = require('./processors/event-processor');
const { OutputManager } = require('./utils/output-manager');
const { StringUtils } = require('./utils/string-utils');
const { InputValidator } = require('./validators/input-validator');

/**
 * Main entry point for the Maven Build Action
 */
async function run() {
  try {
    core.info('🚀 Starting Maven Action...');
    // Validate all inputs first (security critical)
    const inputValidator = new InputValidator();
    const validatedInputs = inputValidator.validateInputs();
    const stringUtils = new StringUtils();
    const nameOperation = stringUtils.toCamelCase(validatedInputs.operation)
    
    // Log sanitized inputs for debugging
    core.debug(`Validated inputs: ${JSON.stringify(inputValidator.sanitizeForLogging(validatedInputs), null, 2)}`);
    
    // Initialize components
    const outputManager = new OutputManager();
    const eventProcessor = new EventProcessor();
    const mavenHandler = new MavenActionHandler(outputManager, validatedInputs);
    
    // Process GitHub event context
    const eventContext = await eventProcessor.processEvent();
    core.info(`📋 Processing event: ${eventContext.eventName}`);
    
    // Execute Maven operations based on inputs and event
    const result = await mavenHandler.execute(eventContext);
    
    // Set outputs
    outputManager.setOutputs(result);
    
    // Create job summary
    await outputManager.createJobSummary(result);
    
    core.info(`✅ Maven ${nameOperation} Action completed successfully`);
    
  } catch (error) {
    core.setFailed(`❌ Action failed: ${error.message}`);
    core.debug(error.stack);
  }
}

// Execute the action
run();