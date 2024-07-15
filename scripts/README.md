# Local Setup
For most scripts here you'll need Firebase credentials. You can get this by going to
https://console.firebase.google.com/u/0/project/collaborative-learning-ec215/settings/serviceaccounts/adminsdk

From that page if you click "Generate a new private key", it will download a json file. You should rename this file `serviceAccountKey.json` and move it to the the scripts folder.

Most scripts can be run using `npx tsx <script filename>`

# Running scripts that connect with the portal
You need to first get the portal admin api token.

In 1Password you can find it in the Developer Admin vault under a "Learn Portal admin api user" entry.

If the 1Password entry is out of date. You can also get it this way:
You can follow these steps to get a console in the portal:
https://docs.google.com/document/d/1dmAV4ojzwau2C-TANvoxw9jAnUN2F5FdOSSy6f42H84/edit#heading=h.l053izhapf0l
Then look for the admin api user:
`api_user = User.where(:login => "admin_api_user").first`
`api_user.access_grants.first.access_token`

This api user was probably created by this rake task: https://github.com/concord-consortium/rigse/blob/97a4bf3a2a911f88424b502361ae8dafd71d9823/rails/lib/tasks/api.rake#L18

This access token should be stored in a /scripts/.env file with:
```
PORTAL_ACCESS_TOKEN=76580a138af6909c6758bdbea0cd8e12
```

# Running on Google Cloud Virtual Machine

It can be useful to offload the running of scripts to a virtual machine in Google Cloud. They will usually run faster there.

1. Log in to Google Cloud at https://cloud.google.com/ and go to the Console.

2. Click the Compute Engine option, then click "Create Instance".

3. Select the Marketplace option and search for "nodejs". Select the Free filter, then choose Node.js - Google Click to Deploy, and click the Launch button.

4. Name the instance, set the Zone value to match the Firestore instance's zone (currently `us-central1` for collaborative-learning), and then set Series to "E2" and Machine Type to "e2-standard-8", then click the Deploy button.

5. Uncheck the "Allow HTTP traffic from the internet" option, this server is just for running scripts that connect to firebase services, there shouldn't be a reason to allow access to the server from the internet.

6. With the VM running, SSH into it. You can SSH via a web browser window from the VM console by selecting SSH > Open in browser window.

7. Once you're connected, git clone the repo: `git clone https://github.com/concord-consortium/collaborative-learning.git && cd collaborative-learning`

8. npm install the dependencies
    ```
    npm install
   ```

9. Manually add the `serviceAccountKey.json` file to the /scripts folder so you can access Firebase. If using the SSH via a web browser option, there is an upload button you can use to upload the file. It will be added to the home folder of the current user. So you need to move it from there into the scripts folder.

10. Run scripts, e.g., `node --loader ts-node/esm update-supports-images.ts`

11. You can make edits locally and push up branches that you pull down on the server. Or you can use `nano` to edit files. You could also install a different local editor. It should also be possible to setup a VSCode server so you can run vscode locally and remotely connect to the server.

## Possible Better Alternative

It hasn't been tried, but it might be even better to use google cloud shell to run VSCode:
- https://medium.com/google-cloud/how-to-run-visual-studio-code-in-google-cloud-shell-354d125d5748

The downside of doing that (I think) is any plugins you have in your local VSCode will have to be re-installed.
It should also be possible to connect your local VSCode to the code-server described above. But I'm not sure if CloudShell will allow the external connection that your local VSCode will need.
