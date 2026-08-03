Step 1: Open Your Terminal

Step 2: Create the Virtual Environment
Run the following command to create a folder named .venv that will hold your isolated Python setup.

Mac: 'python3 -m venv .venv'

Windows: 'python -m venv .venv'

Step 3: Activate the Virtual Environment
You must do this every time you open a new terminal to work on your project. You will know it worked when you see (.venv) appear at the start of your terminal prompt line.
Example => (.venv) (base) akukweebube@Akukwes-Laptop

Mac:

Bash
'source .venv/bin/activate'
Windows (Command Prompt):

DOS
.venv\Scripts\activate.bat
Windows (PowerShell):

PowerShell
'.venv\Scripts\Activate.ps1'
(Note: If PowerShell gives you a red error about "Execution Policies", run this command once as Administrator: Set-ExecutionPolicy Unrestricted -Scope CurrentUser, then try activating again).

Step 4: Install the Required Libraries
Now that your environment is active, install the libraries we used in the code. This command is exactly the same for both Mac and Windows:

Bash
'pip install pandas scipy matplotlib seaborn numpy'
(Pro-Tip: To make this even easier to reproduce later, you can freeze these into a text file by running pip freeze > requirements.txt after installing them).

Step 5: Run the notebooks cells
Run the notebook cells, when prompted for environment(asked usually only once), choose the (.venv) you just created.

VS Code will prompt you to install what you dont't have installed to be able to run notebooks with a virtual environment (.venv), do well to click install when prompted.
