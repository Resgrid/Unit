#!/usr/bin/env node
/* eslint-env node */

const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const projectPath = path.join(__dirname, '../ios/ResgridUnit.xcodeproj/project.pbxproj');
const project = xcode.project(projectPath);

const soundFiles = [
  'notification.wav',
  'callclosed.wav',
  'callupdated.wav',
  'callemergency.wav',
  'callhigh.wav',
  'calllow.wav',
  'callmedium.wav',
  'newcall.wav',
  'newchat.wav',
  'newmessage.wav',
  'newshift.wav',
  'newtraining.wav',
  'personnelstaffingupdated.wav',
  'personnelstatusupdated.wav',
  'troublealert.wav',
  'unitnotice.wav',
  'unitstatusupdated.wav',
  'upcomingshift.wav',
  'upcomingtraining.wav',
  'c1.wav',
  'c2.wav',
  'c3.wav',
  'c4.wav',
  'c5.wav',
  'c6.wav',
  'c7.wav',
  'c8.wav',
  'c9.wav',
  'c10.wav',
  'c11.wav',
  'c12.wav',
  'c13.wav',
  'c14.wav',
  'c15.wav',
  'c16.wav',
  'c17.wav',
  'c18.wav',
  'c19.wav',
  'c20.wav',
  'c21.wav',
  'c22.wav',
  'c23.wav',
  'c24.wav',
  'c25.wav',
];

project.parse(function (err) {
  if (err) {
    console.error('Error parsing Xcode project:', err);
    process.exit(1);
  }

  let modified = false;
  const target = project.getFirstTarget();

  soundFiles.forEach((fileName) => {
    const fileInProject = project.hasFile(fileName);

    if (!fileInProject) {
      try {
        // Add file reference with explicit source tree
        const fileRef = project.addFile(fileName, null, {
          lastKnownFileType: 'audio.wav',
          defaultEncoding: 4,
          sourceTree: '"<group>"',
        });

        if (fileRef) {
          // Add to resources build phase
          const resourcesBuildPhase = target.pbxNativeTarget.buildPhases.find((phase) => {
            const phaseObj = project.pbxResourcesBuildPhaseSection()[phase.value];
            return phaseObj && phaseObj.isa === 'PBXResourcesBuildPhase';
          });

          if (resourcesBuildPhase) {
            project.addToPbxBuildFileSection(fileRef.fileRef);
            project.addToPbxResourcesBuildPhase(fileRef);
            console.log(`✅ Added ${fileName} to Xcode project`);
            modified = true;
          } else {
            console.warn(`⚠️  Could not find resources build phase for ${fileName}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not add ${fileName}:`, error.message);
      }
    } else {
      console.log(`✓ ${fileName} already in project`);
    }
  });

  if (modified) {
    fs.writeFileSync(projectPath, project.writeSync());
    console.log('\n✅ Xcode project updated successfully');
  } else {
    console.log('\n✓ All files already present in Xcode project');
  }
});
