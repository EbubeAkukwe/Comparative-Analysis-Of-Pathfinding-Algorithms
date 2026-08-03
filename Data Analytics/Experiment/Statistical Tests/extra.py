# 1. Clean columns with the '±' format
def clean_numeric(val):
    if isinstance(val, str):
        # Extract the mean part and convert to float
        return float(val.split('±')[0])
    return float(val)

df['Execution_Time'] = df['Execution_Time'].apply(clean_numeric)