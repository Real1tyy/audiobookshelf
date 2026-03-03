const { version } = require('../../package.json')

module.exports.notificationData = {
  events: [
    {
      name: 'onBackupCompleted',
      requiresLibrary: false,
      description: 'Triggered when a backup is completed',
      descriptionKey: 'NotificationOnBackupCompletedDescription',
      variables: ['completionTime', 'backupPath', 'backupSize', 'backupCount', 'removedOldest'],
      defaults: {
        title: 'Backup Completed',
        body: 'Backup has been completed successfully.\n\nPath: {{backupPath}}\nSize: {{backupSize}} bytes\nCount: {{backupCount}}\nRemoved Oldest: {{removedOldest}}'
      },
      testData: {
        completionTime: '12:00 AM',
        backupPath: 'path/to/backup',
        backupSize: '1.23 MB',
        backupCount: '1',
        removedOldest: 'false'
      }
    },
    {
      name: 'onBackupFailed',
      requiresLibrary: false,
      description: 'Triggered when a backup fails',
      descriptionKey: 'NotificationOnBackupFailedDescription',
      variables: ['errorMsg'],
      defaults: {
        title: 'Backup Failed',
        body: 'Backup failed, check ABS logs for more information.\nError message: {{errorMsg}}'
      },
      testData: {
        errorMsg: 'Example error message'
      }
    },
    {
      name: 'onTest',
      requiresLibrary: false,
      description: 'Event for testing the notification system',
      descriptionKey: 'NotificationOnTestDescription',
      variables: ['version'],
      defaults: {
        title: 'Test Notification on Abs {{version}}',
        body: 'Test notificataion body for abs {{version}}.'
      },
      testData: {
        version: 'v' + version
      }
    }
  ]
}
